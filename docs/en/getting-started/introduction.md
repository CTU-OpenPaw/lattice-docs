---
title: Introduction to LatticeDX
description: Six-plane architecture, seven Apache-2.0 plugins, eight-role workspace model, and Pure-OSI runtime boundaries of LatticeDX 0.4.2.
---

# Introduction to LatticeDX

LatticeDX (`0.4.2`) is an open-source digital enterprise operating platform (`DX-OS`) licensed under `Apache-2.0`. It unifies multi-portal business applications, DAG and DMN workflow automation, industrial IIoT digital twins, and RBAC-governed AI agents on top of an external `nocobase/nocobase:2.2.50` host container (`sdkProvidedByHost: true`).

## Six-Plane DX-OS Architecture

The platform separates runtime responsibilities across six architectural planes so network boundaries, tenant isolation, and component updates remain independent.

| Plane | Primary Components | Engineering Responsibility | Deep Dive |
| :--- | :--- | :--- | :--- |
| **Edge & Identity** | `Caddy 2.10`, `Apache APISIX 3.19.0`, `Keycloak 26.8.2` | TLS termination, HSTS/CSP security headers, Valkey-backed rate limiting, OIDC PKCE `S256` flows, and backchannel session revocation. | [Security Model](/en/architecture/security-model) |
| **Host & Multi-Portal UI** | `nocobase/nocobase:2.2.50`, `8` `ldx_*` roles, `12` Native v2 BlockModels | Role-scoped workspaces (`/p/<slug>`), zero-PII public intake forms (`/v/form/:slug`), and an offline-capable field PWA (`/v/mobile`). | [Multi-Portal Architecture](/en/studio/multi-portal) |
| **Data & Tenant Isolation** | `PostgreSQL 16.16`, `pgvector 0.8.1`, `Valkey 8.1`, `RustFS 1.0.6`, `ClamAV 1.5.5` | Transaction-local `FORCE ROW LEVEL SECURITY` across `56` static tables and dynamic `latticeCustom*` tables using `app.current_org`. | [Multi-Tenancy & RLS](/en/architecture/multi-tenancy-rls) |
| **Automation & Decisions** | `LatticeFlow v2` (`24` node types), `Visual DMN 1.3`, `n8n 2.48.1` | Durable DAG execution with persistent loop cursors, HITL approval pause/resume, FEEL decision tables, and stock `n8n` REST v1 bridging. | [LatticeFlow Overview](/en/automation/latticeflow-overview) |
| **AI Studio & Knowledge** | `7` Agent Profiles, `20` Unified Tools, `MCP` / `A2A`, `P.A.R.A. Hybrid RAG` | Audited ReAct execution with PII scrubbing and daily quotas, `plan -> build -> patch -> rollback` app synthesis, and RRF vector/BM25 retrieval. | [AI Overview & Profiles](/en/ai/overview-and-profiles) |
| **IIoT Digital Twin & PKI Ledger** | `Mosquitto 2.0.21`, `Node-RED 4.0.9`, `Orion-LD 1.12.0`, `Ed25519 + Merkle` | Dynamic-Security MQTT ingestion, FIFO NGSI-LD outbox delivery, Arrhenius MKT calculations, and immutable Ed25519 ePOD verification. | [IIoT Digital Twin](/en/domains/iiot-digital-twin) |

## Modular Seven-Plugin Core (`Apache-2.0`)

All platform extensions reside under `plugins/nocobase/*`. Every package shares the `0.4.2` version lock, declares `"sdkProvidedByHost": true`, and compiles against host-provided externals without bundling upstream NocoBase source into Git.

| Directory | Package Name (`package.json`) | Server Entrypoint | Core Responsibilities |
| :--- | :--- | :--- | :--- |
| `action-bridge/` | `@latticedx/plugin-action-bridge` | `server.cjs` | Action proxy and OIDC delegation bridge between the NocoBase host and the APISIX gateway. |
| `plugin-lattice-foundation/` | `@latticedx/plugin-lattice-foundation` | `dist/server/index.js` | Transaction-local RLS (`app.current_org`, `app.rls_bypass`), `ldx_pat_*` API keys, Ed25519/Merkle ledger, CloudEvents/NGSI-LD outboxes, portals, public forms, mobile PWA, approvals, notifications, OTel, and Prometheus metrics. |
| `plugin-enterprise-auth/` | `@latticedx/plugin-enterprise-auth` | `dist/server/index.js` | Keycloak OIDC PKCE `S256` handshake (`start`, `callback`, `finish`), group-to-role mapping, and Valkey DB 2 revocation enforcement. |
| `plugin-dxos-para/` | `@latticedx/plugin-dxos-para` | `dist/server/index.js` | P.A.R.A. workspace taxonomy (`Projects`, `Areas`, `Resources`, `Archives`) scoped per organization. |
| `plugin-dxos-blocks/` | `@latticedx/plugin-dxos-blocks` | `dist/server/index.js` | Registers `12` Native v2 `Dxos*BlockModel` components (Hero, KPI, Telemetry, AI Proposal, Tasks, P.A.R.A., Creative Studio, Workbench, WebGIS MapLibre, Kanban, WMS FEFO, BI Chart). |
| `plugin-dxos-studio/` | `@latticedx/plugin-dxos-studio` | `dist/server/index.js` | `LatticeFlow v2` DAG engine, `Visual DMN` evaluator, dynamic `latticeCustom*` schema builder with safe AST formulas, `Solution Bundle v3`, Cold-Chain OMS/WMS/FEFO/ePOD, and `n8n` / `OAuth2 PKCE` connector vault. |
| `plugin-dxos-ai/` | `@latticedx/plugin-dxos-ai` | `dist/server/index.js` | `7` Agent Profiles, `20` audited Unified Tools, `App Builder 2.0`, `MCP Gateway` (`/api/dxos-mcp`), `A2A Gateway` (`/api/dxos-a2a`), `P.A.R.A. Hybrid RAG`, OCR extraction, and `Eval Lab`. |

See [Plugin System Architecture](/en/architecture/plugin-system) for `esbuild` scripts, shared host externals (`react@18.2.0`, `antd@5.24.2`, `@nocobase/server`), and plugin boot lifecycle details.

## Request Lifecycle & Companion Services

Every inbound API request passes through deterministic enforcement layers from edge termination down to the database transaction:

| Request Stage | Enforcement Mechanism |
| :--- | :--- |
| Edge Termination & Rate Limiting | `Caddy 2.10` terminates TLS, sets HSTS/CSP security headers, and forwards traffic to `Apache APISIX 3.19.0`. APISIX injects `X-Request-Id`, applies strict CORS, and enforces Valkey-backed `limit-count` windows per remote IP. |
| Session & Tenant Context Binding | The NocoBase host validates either a `Keycloak` OIDC session or a SHA-256 hashed `ldx_pat_*` API key. `withTenantRlsContext` opens a Sequelize transaction via `AsyncLocalStorage` and runs `SELECT set_config('app.current_org', :orgId, true)` under the non-superuser `nocobase_app` role. |
| Transactional Outbox & Audit Commit | Business mutations, outbox rows (`latticeEventBus`, `latticeContextOutbox`), and hash-chained ledger entries (`latticeCryptoLedger`) commit in the same database transaction so downstream state never diverges. |

Beyond the NocoBase host plugins, the workspace operates dedicated companion services and agent interoperability gateways:

| Component | Protocol / Port | Core Responsibility |
| :--- | :--- | :--- |
| `@dx/api` & `@dx/agent-worker` | HTTP REST `/v1/*` (`:4000` / `:4001`) | Fastify core API and worker handling records, retention previews, queues, and diagnostics. |
| `@dx/file-scanner` | HTTP `:4010` + `ClamAV :3310` | Scans uploaded attachments over the isolated `scanner` network before storing in `RustFS` or `PostgreSQL`. |
| `MCP Gateway` | Streamable HTTP JSON-RPC 2.0 (`/api/dxos-mcp`) | Exposes `20` Unified Tools and `4` IT/OT tools (`/api/dxos-mcp/it-ot`) filtered by caller RBAC. |
| `A2A Gateway` | `/.well-known/agent-card.json` & `/api/dxos-a2a` | Publishes the Agent Card and processes asynchronous `tasks/send`, `tasks/get`, and `tasks/cancel` calls. |

## Core Architectural Constants

The parameter matrix below summarizes fixed platform invariants in release `0.4.2`:

<ParamGrid
  title="LatticeDX 0.4.2 Platform Invariants"
  :items="[
    { name: 'platformVersion', type: 'semver', required: true, default: '0.4.2', description: 'Locked version across root package.json and all 7 plugin packages.' },
    { name: 'nocobase.testedRuntime', type: 'oci-tag', required: true, default: '2.2.50', description: 'Digest-pinned nocobase/nocobase host container version.' },
    { name: 'nocobase.sdkProvidedByHost', type: 'boolean', required: true, default: 'true', description: 'Plugins bind to host @nocobase/* packages at runtime without bundling core source.' },
    { name: 'pg.rlsGucs', type: 'session-guc', required: true, default: 'app.current_org / app.rls_bypass', description: 'Transaction-local PostgreSQL GUCs enforcing FORCE RLS across 56 static tables and dynamic tables.' },
    { name: 'pg.runtimeRole', type: 'pg-role', required: true, default: 'nocobase_app', description: 'Production PostgreSQL runtime role created with NOSUPERUSER NOINHERIT NOBYPASSRLS.' },
    { name: 'valkey.databases', type: 'db-partition', default: 'DB 0 / DB 1 / DB 2', description: 'DB 0 for Cache, DB 1 for SSE PubSub, DB 2 for OIDC PKCE state and session revocation.' },
    { name: 'pat.scopes', type: 'enum[7]', default: 'read, write, wms, dmn, iot, ai, ledger', description: 'Seven scoped permission tags enforced on SHA-256 hashed ldx_pat_* API keys.' },
    { name: 'solutionBundle.schema', type: 'string', default: 'latticedx.solution-bundle/v3', description: 'GitOps solution bundle schema with SHA-256 integrity hashing and rollback snapshots.' }
  ]"
/>

## Eight Business Workspace Roles (`ldx_*`)

Alongside the host `root` and `admin` roles, LatticeDX provisions `8` business roles that govern portal navigation (`/p/<slug>`) and AI tool authorization:

| Role Key | Operational Persona | Typical Portal & Action Scope |
| :--- | :--- | :--- |
| `ldx_admin` | Organization Administrator | Manages tenant portals, `ldx_pat_*` API keys, outbound connectors, and org-scoped RBAC. |
| `ldx_director` | Operations Director | Approves high-threshold `M-of-N` requests, reviews cross-module BI charts, and oversees operations. |
| `ldx_manager` | Department Manager | Handles `control.approval` workflow steps, maintains DMN tables, and resolves exceptions. |
| `ldx_operator` | IT/OT Operations Engineer | Monitors WebGIS digital twins, acknowledges or escalates IIoT alarms, and dispatches HITL commands. |
| `ldx_warehouse` | Warehouse Specialist | Executes `FEFO` stock allocations, manages `latticeStockLots`, and handles `MKT` quality holds. |
| `ldx_dispatcher` | Fleet Dispatcher | Schedules logistics orders, assigns routes, and tracks proof-of-delivery completion. |
| `ldx_driver` | Field Driver | Operates the offline PWA at `/v/mobile`, capturing `ePOD` signatures and photos into IndexedDB. |
| `ldx_employee` | Internal Staff | Submits procurement requests and service tickets, queries the `P.A.R.A.` vault, and completes tasks. |

Security boundary: Keycloak group-to-role mapping (`DX_NATIVE_AUTH_GROUP_ROLE_MAP`) explicitly skips privileged roles (`ldx_admin`, `allowConfigure`, and `pm*` snippets) to prevent unvetted privilege escalation via IdP group claims.

## Primary Operational Workloads

LatticeDX targets operational domains that require no-code UI adaptability backed by strict relational isolation and cryptographic traceability:

| Operational Workload | Core Architectural Capabilities |
| :--- | :--- |
| Cold-Chain OMS/WMS and Verifiable ePOD | Manages orders, lot/batch inventory under `FEFO` (First Expired, First Out) allocation, automated quality holds when Arrhenius Mean Kinetic Temperature (`MKT`) exceeds thresholds, and public QR verification backed by `Ed25519` signatures in `latticeCryptoLedger`. |
| Bidirectional IIoT Digital Twins (NGSI-LD) | Field sensors publish telemetry to `Eclipse Mosquitto` (Dynamic Security ACLs, anonymous access disabled) on the isolated `iiot-net` bridge. `Node-RED` normalizes payloads into NocoBase and `FIWARE Orion-LD`, while downlink setpoint changes enforce Human-in-the-Loop (`HITL`) approval whenever temperature deltas exceed `2.0°C`. |
| Hybrid Workflow & Decision Automation | Combines `LatticeFlow v2` (`24` node types with durable `loopCursors` and `M-of-N` approval suspension), `Visual DMN` rule tables (`FIRST`, `UNIQUE`, `COLLECT`, `PRIORITY` hit policies), and external `n8n` workflows connected via `OAuth2 PKCE` and Standard Webhooks. |
| Governed AI Workforce & App Synthesis | Runs `7` Agent Profiles inside the caller's exact RBAC and PostgreSQL RLS boundary across `20` Unified Tools and `4` IT/OT MCP tools. Requests enforce PII redaction (national IDs, phone numbers, bank accounts, tax IDs, JWTs), daily call/token/USD quotas, and OpenTelemetry GenAI span export. |

## Pure-OSI Boundary & NocoBase Attribution

Every workspace package in `lattice-dx` adheres to Pure-OSI licensing (`Apache-2.0`, `MIT`, `BSD`, `ISC`) with zero proprietary or `BSL-1.1` source dependencies:

- The repository and source release tarballs contain **no** `upstream/nocobase/` tree and **no** `.gitmodules`.
- The digest-pinned `nocobase/nocobase:2.2.50` OCI image (`@sha256:04b75164936e7314ef74d82844bc56c9f34ed7ff1ca976ca53ffac2d3c88d777`) runs as an external container with all `7` plugins mounted read-only (`:ro`) under `/app/nocobase/node_modules/@latticedx/*`.
- `Powered by NocoBase` (`v2.2.50`, `https://www.nocobase.com`) and `License settings` remain visible and unmodified in accordance with NocoBase License Agreement Clause 5.2.
- Caching and pub/sub use `Valkey 8.1` (`BSD-3-Clause`), while vector search and sensor time-series storage run on `PostgreSQL 16` + `pgvector 0.8.1`.

## Ecosystem Repositories

CTU-OpenPaw organizes platform code, documentation, templates, and governance across four repositories:

| Repository | Role | Key Artifacts |
| :--- | :--- | :--- |
| `CTU-OpenPaw/lattice-dx` | Core platform & deployment infra | `7` NocoBase plugins, Fastify companion API/Worker/File-Scanner, `infra/compose/*.yml` stacks, and PITR backup/recovery scripts. |
| `CTU-OpenPaw/lattice-docs` | Bilingual technical portal | Guides, architecture specs, API reference, and interactive diagrams across `9` sections (Vietnamese `/` and English `/en/`). |
| `CTU-OpenPaw/lattice-templates` | GitOps template catalog | `43` validated JSON artifacts covering `latticeflow-blueprints`, `n8n-workflows`, `dmn-tables`, `business-packs`, `public-forms`, and `Solution Bundle v3`. |
| `CTU-OpenPaw/.github` | Organization profile & policies | Shared contribution standards, security disclosure policy, and ecosystem catalog. |

## Core Health & Discovery Endpoints

Once the host runtime is online, platform health checks and machine-readable API contracts are immediately reachable from the local or edge gateway:

<ApiEndpoint
  method="GET"
  path="/api/app:getLang"
  auth="Public"
  summary="Verifies NocoBase host runtime readiness and returns the active default locale."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:openapi"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="read"
  summary="Serves the OpenAPI 3.1.0 specification, dynamically introspecting runtime latticeCustom* collections."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:asyncapi"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="read"
  summary="Serves the AsyncAPI 3.0.0 specification covering Mosquitto MQTT, SSE surfaceEvents, and Valkey PubSub."
/>

## Related

- [Quickstart](/en/getting-started/quickstart) — Boot an isolated clean lab via `pnpm native:clean` or start the full local stack with `pnpm local:up`.
- [Installation Profiles](/en/getting-started/installation-profiles) — Compare all `8` Compose files, `5` production profiles, and container sizing limits.
- [Architecture Overview](/en/architecture/overview) — Inspect interactive data flows across all `6` DX-OS planes.
- [Third-Party & NocoBase Boundary](/en/open-source/third-party-and-nocobase) — Review Pure-OSI runtime isolation and Clause 5.2 attribution details.
