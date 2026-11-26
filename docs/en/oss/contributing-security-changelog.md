---
title: Contributing, Security & Changelog
description: Contributing guidelines, Security Policy, strict pre-GA < 1.0.0 versioning policy (0.4.2), and full release changelog (v0.2.0 to 0.4.2) for LatticeDX.
---

# Contributing, Security Policy & Release Changelog

This page consolidates community contribution standards, security disclosure procedures, the pre-GA **`< 1.0.0`** versioning lock (**`0.4.2`**), and the verified release history from **`v0.2.0`** through **`0.4.2`**.

---

## 1. Contributing Guidelines

Contributions to [`CTU-OpenPaw/lattice-dx`](https://github.com/CTU-OpenPaw/lattice-dx) and [`CTU-OpenPaw/lattice-docs`](https://github.com/CTU-OpenPaw/lattice-docs) are licensed under **`Apache-2.0`**.

### Development Setup & Code Conventions

- **Required Toolchain:** `Node.js 24` (`>=24 <25`), `pnpm 10.23.0`, `Git`, `tar`, and `Docker Compose v2+` (when testing container stacks).
- **Install with Frozen Lockfile:** `pnpm install --frozen-lockfile`.
- **Directory Placement:** Standalone Node/TypeScript services belong in `apps/`, shared contracts in `packages/`, and NocoBase runtime extensions in `plugins/nocobase/`.
- **Modularity Guideline:** Keep source files focused and cohesive (recommended **`< 300` lines per file** for new modules). Do not cross-import internal code across `apps/*` in production; communicate via public `@dx/contracts` exports or HTTP/REST boundaries.
- **Mandatory SPDX Headers:** Every human-authored source file supporting comments (`.ts`, `.tsx`, `.js`, `.jsx`, `.cjs`, `.mjs`, `.css`, `.sql`, `.yml`, `.yaml`, `.ps1`, `.sh`, `Dockerfile`) must carry `@copyright (C) 2026 CTU-OpenPaw` and `SPDX-License-Identifier: Apache-2.0`. Never edit auto-generated `apps/web/next-env.d.ts`.
- **Pure-OSI & Zero Upstream Rule:** Never introduce `upstream/nocobase/`, `.gitmodules`, `BSL-1.1` dependencies, ThingsBoard, or EMQX. Vet any new dependency's license compatibility and update `docs/dependency-inventory.md`, `NOTICE`, and `docs/sbom-cyclonedx.json`.
- **No Secrets:** Never commit `.env` files (other than `.env.example`), tokens, `*.pem`/`*.key` private keys, or real production data.

### Issue Tracking & Pre-PR Checklist

- **Issues:** Use the structured forms under `.github/ISSUE_TEMPLATE/` (`bug_report.yml`, `feature_request.yml`, `config.yml`).
- **Commits:** Follow Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`).
- **Mandatory Checks Before Opening a PR:**
  1. `pnpm check` (`typecheck`, `vitest`, `build`) passes cleanly.
  2. `node scripts/source-headers.mjs --check` and `pnpm pof:check` pass (`6/6`).
  3. `node --test plugins/nocobase/*/tests/*.test.cjs scripts/tests/*.test.mjs tests/nocobase-externals.test.mjs` passes when modifying plugins or PoF/demo scripts.
  4. `docker compose -f <file> config --quiet` and `pnpm test:infra` pass when modifying `infra/compose/*.yml`, with every OCI image pinned by `@sha256:`.
  5. Review `git diff` to ensure zero unresolved `TODO`s, debug logs, or sensitive data.

---

## 2. Security Policy

### Supported Versions

| Version / Branch | Support Status |
| --- | --- |
| **`0.4.2`** (`0.4.x` on `main` in `CTU-OpenPaw/lattice-dx`) | Actively supported with security patches |
| `< 0.4.2` | Unsupported — upgrade to `0.4.2` |

### Local Loopback Fixture Credentials Warning

Default compose stacks (`infra/compose/*.yml`) and local evaluation guides (`docs/native-clean-install.md`, `docs/core-local.md`) contain **public loopback fixture passwords** strictly for `127.0.0.1` / `localhost` testing (such as `local-demo-password`, `local-admin-password`, `local-nocobase-password`, `admin123`, `NativeLab-2026!`, and `local-nocobase-app-key-public-fixture`). **Never** reuse these fixtures in Internet-facing or production environments; rotate all secrets, signing keys, and TLS certificates before deployment.

### Implemented Security Boundaries

- **Identity & Multi-Tenant Isolation:** Core APIs validate Keycloak JWT signatures (`OIDC_ISSUER` / `OIDC_JWKS_URL`), enforce `organization_id` scoping and optimistic locking (`expectedVersion`), and isolate PostgreSQL rows across **56 static `lattice*` tables** (+ dynamic `latticeCustom*`) using **`FORCE ROW LEVEL SECURITY`** under the non-superuser `nocobase_app` role. `@latticedx/plugin-enterprise-auth` uses Authorization Code + PKCE S256.
- **Server-Side ACL & Scope:** Read/write permissions and scoped PaaS API Keys (`ldx_pat_<8hex>_<32hex>`, SHA-256 hashed at rest, 7 scopes) are enforced server-side per request; client metadata never substitutes for backend authorization.
- **Malware Quarantine:** Uploaded files in the shared storage overlay (`infra/compose/native-files.yml`) and production stack are scanned via **ClamAV `1.5.5`** over TCP `clamd` with **RustFS `1.0.6`** object quarantine before download.
- **Container Integrity:** All 19 OCI container images in `infra/compose/*.yml` are pinned by immutable `@sha256:` digests.

### Private Vulnerability Reporting

Do **not** disclose vulnerabilities, tokens, `.env` files, or private keys in public GitHub Issues or Pull Requests. Report privately via **GitHub Security Advisories**:

- **https://github.com/CTU-OpenPaw/lattice-dx/security/advisories/new**

Include the affected repository/path, commit SHA, minimal reproduction steps, and impact scope.

---

## 3. Pre-GA `< 1.0.0` Versioning Policy (`0.4.2`)

LatticeDX enforces a strict **`< 1.0.0` pre-GA version lock**:

- **Current Authoritative Version:** **`0.4.2`** (synchronized across root `package.json`, all 7 `plugins/nocobase/*/package.json` manifests, `COPYRIGHT.txt`, `NOTICE`, `CHANGELOG.md`, `docs/sbom-cyclonedx.json`, and `latticedx-0.4.2-src.tar.gz`).
- **No Unapproved Major GA Bump:** Releases remain strictly under the `0.x.y` (`< 1.0.0`) pre-GA series unless explicitly approved by the project maintainer. Do not bump manifests, release tags, or documentation references out of `< 1.0.0` without authorization.

---

## 4. Release Changelog (`v0.2.0` – `0.4.2`)

Synchronized from [`CHANGELOG.md`](https://github.com/CTU-OpenPaw/lattice-dx/blob/main/CHANGELOG.md) in `CTU-OpenPaw/lattice-dx`:

### `[0.4.2]` — 2026-11-26 — Full P0/P1 Audit Remediation, UX Completion & Live `124/124` E2E Hardening

- **Data Integrity, Multi-Tenant Security, PG16 `FORCE RLS` (56 Tables), Node-RED & PITR:**
  - Prevented cross-tenant `DROP TABLE` in `teardownBuiltApp(keepData=false)` (`app-builder-orchestrator.js`) via system-wide `withOptionalSystemRls` checks and physical table verification prior to DDL, cleaning routes, roles, and `db.removeCollection`.
  - Expanded PG16 `FORCE ROW LEVEL SECURITY` to **`56` static tables** (adding `latticeAiQuotaPolicies` and `latticeUiSnapshots`), closed all 6 transaction RLS escape paths (`voucher-lifecycle`, `event-bus`, `proactive-triage`, `solution-bundle`, `ai-hitl-executors`, `studio-resource`), eliminated `.catch(() => {})` on `saveQuotaPolicy`, and persisted AI quota accounting in PostgreSQL.
  - Restricted `ldx_employee` from accessing LatticeFlow Studio (`FlowStudioApp`, `WorkflowConnectorsPage`, and `dxosAutomations` read/run actions), enforced ACL on `dxosDmn:listTables`, standardized `403` cross-org responses on `dxosApiKeys:list`, scoped `dxosAi:surfaceEvents` to `${organizationId}::${portalSlug}`, and added `redirect: 'error'` + DNS SSRF guards in `ai-llm-health.js`.
  - Enforced fail-closed `NODERED_ADMIN_PASS_HASH` in production + AES-256-CTR `flows_cred.json` encryption; completed `scripts/pitr-backup.mjs --backend=local-gz` and `pitr-archive.sh` for `.gz` WAL archiving; deduplicated CI triggers and upgraded `codeql-action@v4`.
- **Auth, Onboarding, Public Portals & Mobile Field PWA (`/v/mobile`):**
  - Transitioned `400/403/404/409/422` sync errors on `/v/mobile` IndexedDB Outbox to **`quarantined`** state (allowing order-code repair and JSON export without losing ePOD payloads), added JWT `exp` decoding + immediate stop on first `401`, `gpsUnavailable` cold-storage support, `409 Conflict` UI handling, ticket/incident outbox, ACL-scoped Digital Twin visibility, SSR `<link rel="manifest">` + `192`/`512` PNG icons, `>= 44px` touch targets, and `100dvh` AI drawer layout.
  - Hardened `/v/track/:code?verify=...` across SSR and React (public Ed25519 signature verification without bypassing `trackingToken` for ePOD/PII) and upgraded `/v/form/:slug` with file attachments, manual status lookup, `"Gửi hồ sơ khác"`, and Vietnamese validation errors.
  - Redirected `root` from `/admin` to `/admin/lattice-workspace`, added Blank-Slate Setup Checklist, eliminated spurious `401` on `/signin`, returned clean `200` warnings on `enterpriseAuth:configuration`, and added `"← Quay lại Workspace v2"` breadcrumbs on `/lattice/*`.
- **12 Native v2 BlockModels, P.A.R.A. RAG/OCR, AI Studio, Control Studio & LatticeFlow v2:**
  - Fixed `DxosParaVaultView` paginated `contentMarkdown`, added `dxosWms:releaseLotByQa` and `root` org selection in `WmsOps`, direct approval CTAs on `AiProposal`/`WorkflowTasks`, parameterized SQL pushdown for `BiChart aggregateQuery` and `Ctrl+K globalSearch`, and `minify: true` builds for `plugin-dxos-blocks` & `plugin-dxos-studio`.
  - Fixed OCR-to-Record field retention (`qtyOnHand`/`productName`/`lotCode`), `status = 'active'` filtering and flexible `8..8192` `pgvector` dimensions in Hybrid RAG, PII redaction in `doc.summary`, and clear errors on encrypted/scanned PDFs.
  - Bundled all **`163` Eval cases** into runtime Eval Lab, synchronized Audit Log filters, added HITL `executionResult`/`expiresAt`/`failed`/`executing` states, scoped `rollbackEnterpriseApp` by app `blockUids`, added `dxosAi:listLlmServices`, and added AI Chat retry cards.
  - Completed UI for **Omnichannel Notify (`dxosNotify`, `notify-panel.js`)**, `options` + **`dxosForms:listSubmissions` Viewer** in Public Form Builder, DMN `UNIQUE`/`PRIORITY` + draft simulation, 4-source Unified Approval Inbox badges + Policy Drawer, PKI `expectedKeyId` + `rotateKey` + Merkle JSON export, and GitOps Bundle v3 self-roundtrip.
  - Upgraded LatticeFlow v2 with durable `loopCursor` resume for `control.loop` across HITL/delay pauses, non-blocking `control.merge` `first_completed`, full `ai.agent` schema, row-based `if`/`switch`/`transform` builders, and synchronized client/server Vietnamese validators.
  - Added [`docs/E2E_TESTING_GUIDE_HUNG.md`](https://github.com/CTU-OpenPaw/lattice-dx/blob/main/docs/E2E_TESTING_GUIDE_HUNG.md); verified **`124/124` live Docker Playwright/API E2E PASS**, Tier 5 `NO_GAPS`, **`2,509/2,509`** unit/integration tests (`1,128` Vitest + `1,381` Node), and **`163/163` (100%)** Vietnamese NL Eval.

### `[0.4.1]` — 2026-11-26 — Deep System Audit, End-to-End Feature Completion & Multi-Portal UX Upgrade

- **M1 (Infrastructure, Public Auth, Enterprise Auth & `257/257` SBOM):** Normalized `fsevents@2.3.3 -> MIT` in `generate-sbom.mjs` and `docs/sbom-cyclonedx.json` (**`257/257`** resolved, **`0 NONE`**, `0` prod CVEs); added `10-lattice-public-routes.sh`, APISIX `verifyTrackSignature` route, and `public-branding.js` eliminating `403`/`404`/`401` noise on public routes; upgraded `MappingSettings`.
- **M2 (Portals, BI/WMS/Kanban/Digital Twin, Mobile PWA & P.A.R.A. OCR):** Fixed `DxosBiChartBlockModel` modal clipping, added `vi-VN` formatting and drilldown; completed `WmsOpsBlock`, Kanban/Schedule (`+07:00`), WebGIS Digital Twin drawer, `/v/mobile` Field PWA (removed all stubs), and P.A.R.A. OCR-to-Record creation.
- **M3 (DX-OS AI Studio, App Builder 2.0, MCP, Eval Lab & Multi-Provider LLM):** Implemented real LLM adapters (`google-genai`, `anthropic`, `ollama`, `openai`, `deepseek`, `9router`), `latticeAiQuotaPolicies` (`FORCE RLS`), `organizationId` scoping (`DXOS_ORG_MISMATCH`), renumbered AI Studio tabs `1..9`, and live MCP catalog ping.
- **M4 (Control Studio, Flow Studio, AI Proposals Inbox & 100% Vietnamese Localization):** Unified `latticeAgentProposals` into `approval-engine.js` & Unified Approval Inbox, polished `ConnectedAppsPanel` / `DmnVisualEditor` / `FlowCanvas`, enforced `403` for Manager on `DX-OS Studio`, and added `dxosStudio:seedShowcaseData`.
- **M5 (Multi-Role Navigation, Anti-Blank-Page & Pass 2 Live Audit):** Added automatic employee redirect `/p/logistics` -> `/p/logistics-employee/...`, `PortalRenderRecoveryGuard`, and `uiSchema['x-validation']` fix in `domain-schema-rls.js`; verified `acceptance-blank-slate` (`8/8`), `acceptance-live-llm`, `2,389/2,389` unit/integration tests, and `163/163` NL Eval.

### `[0.4.0]` — 2026-11-26 — DX-OS Open-Core Championship Edition (OLP PMNM 2026)

- **Wave 1 (Headless PaaS Core, Ed25519/Merkle PKI, RLS & Zero-Trust Edge):** Introduced scoped `ldx_pat_*` API keys (`dxosApiKeys`), Ed25519 + Merkle ledger (`dxosLedger`), live OpenAPI 3.1.0 & AsyncAPI 3.0.0 (`/api/dxos:openapi`, `/api/dxos:asyncapi`), Prometheus `/api/dxos:metrics`, Caddy -> APISIX -> Keycloak Zero-Trust edge, and Grafana 360° + Prometheus alerts.
- **Wave 2 (Data Governance, Cold-Chain OMS/WMS/FEFO/ePOD, DMN & 2-Way Digital Twin):** Added Hot–Warm–Cold tiering, frozen snapshots, lineage, quarantine, Arrhenius MKT (`dxosDataGov`), `FOR UPDATE` FEFO WMS (`dxosWms`), zero-`eval` DMN (`dxosDmn`), time-bound delegations (`dxosDelegations`), 2-Way Digital Twin shadows + Node-RED downlink, and 2-phase HMAC bulk import.
- **Wave 3 (Native v2 BlockModels, Governance Studio UI & Mobile Field PWA):** Added `DxosWebGisBlockModel` and `DxosKanbanScheduleBlockModel`, 6 Governance Consoles in `/admin/settings/dxos-studio`, and `/v/mobile` PWA (`NetworkOnly` `/api/*` invariant + offline outbox).
- **Wave 4 (Office XLSX/PPTX/OCR, GraphRAG `#16`, Alarm `#17`, MCP Prompts & Proactive Triage):** Added ZIP/XML `.xlsx`/`.pptx` + PDF `ToUnicode` extraction, `dxos_graph_impact_analysis` and `dxos_alarm_action` tools, MCP prompts/resource templates, and PG advisory-locked Proactive AI Triage with HITL execution.
- **Wave 5 (GitOps Bundle v3, CycloneDX 1.5 SBOM & Headless PaaS Acceptance):** Delivered `latticedx.solution-bundle/v3`, `scripts/generate-sbom.mjs`, `scripts/seed-v100-championship-showcase.mjs`, and `scripts/acceptance-headless-paas.mjs`.
- **Wave 6 (Mosquitto DynSec + LWT, Orion-LD 2-Way, CloudEvents/Webhooks, Vault, Domain Builder & Valkey 8.1):** Implemented pure-`node:net` Mosquitto Dynamic Security (`dxosBroker`), Orion-LD 2-way subscriptions, CloudEvents 1.0 + Standard Webhooks (`dxosEvents`), AES-256-GCM Connector Vault (`dxosVault`), Visual Domain Builder + 1-click `cmms-maintenance` & tenant provisioning (`dxosBuilder`), and pure-OSI **Valkey `8.1`** + PG16 IIoT storage.
- **Wave 7 (LatticeFlow v2 DAG Studio, DX-OS Flow Architect & Pure-OSI `upstream-clean`):** Launched Canvas-First Flow Studio (`@xyflow/react@12.12.1` + `@dagrejs/dagre@3.1.3` `MIT`), 24 built-in node types across 6 groups, durable Pause/Resume HITL, cron/webhook triggers, real LLM Flow Architect (`dxos-architect`), and complete removal of `upstream/nocobase` & `.gitmodules`.
- **Wave 8 (PG `FORCE RLS`, OTel + PITR WAL, Stock `n8n` REST v1 + OAuth2 PKCE, App Builder Self-Healing & UI Polish):** Enforced `FORCE ROW LEVEL SECURITY` via non-superuser `nocobase_app`, OTel OTLP/HTTP exporter, separated PITR WAL volumes, 10 `dxosN8n` REST v1 endpoints + 26-node compliance orchestrator, OAuth2 PKCE S256, `DxosWmsOpsBlockModel`, MapLibre WebGIS, ISO QR + Ed25519 `/v/track/:code`, Visual DMN, SSE Topbar Notification Bell, and `257`-component SBOM.
- **Wave 9 (Blank-Slate AI-First App Builder & `latticeBuiltApps`):** Added `--blank-slate` (`LATTICE_SKIP_DEMO_SEED=1`), `20261129000100-sync-role-presets.js`, `dxosBlocks:collectionsMeta`, `dxosAi:quickConnectLlm`, and Kahn-topological multi-entity orchestration (`latticeBuiltApps`).
- **Wave 10 (App Builder 2.0, Agentic 2026 Core, Enterprise Ops Finish & Modularization):** Delivered Rich Schema Engine (`hasOne`, `belongsToMany` + RLS, AST `formula`, `validation`), Plan-Diff-Approve (`plan_enterprise_app`, `patch_enterprise_app`, `rollback_enterprise_app`) + Visual ER Graph, `DxosBiChartBlockModel` (12th BlockModel), multi-turn ReAct `ai.agent` + 3 `dxos_memory_*` tools (**20 Unified AI Tools**, **7 Starter AI Profiles**), Draft/Publish Flow versions + Live Canvas Step Trace, Google/LF A2A Protocol (`/.well-known/agent-card.json`, `/api/dxos-a2a`), OTel GenAI `latticeAiTraces` + Trace Waterfall & Eval Lab UI, M-of-N Multi-Level Approvals & Unified Inbox, Omnichannel Notify, Public Form Builder (`/v/form/:slug`), and Shared Browser SSE Hub.

### `[0.3.0]` — 2026-11-22 — Full Enterprise Platform, AI HITL, Semantic RAG & Pure-OSI IIoT

- Upgraded Record Chatter (`@mention` + immutable voucher lifecycle `Submit`/`Cancel`/`Amend`), Unicode PDF governed export, persistent PostgreSQL AI quota buckets, and 2-way Keycloak OIDC + PKCE role sync.
- Added real-time SSE Notification Bell (`latticeNotifications`), SLA Engine (`latticeSla`), full GitOps Solution Bundle diff/rollback, and `/mobile` portal.
- Implemented semantic neural RAG (`latticeParaChunks`, PDF/DOCX extraction, `pgvector` HNSW + RRF), AI HITL approval queue (`latticeAiApprovalQueue`), and Pure-OSI IIoT (`Mosquitto 2.0.21` + `Node-RED 4.0.9` + `PostgreSQL 16` time-series), removing BSL-1.1 ThingsBoard/EMQX.
- Separated `apps/file-scanner` (ClamAV + RustFS) sidecar, achieved zero `pnpm audit` vulnerabilities, and upgraded external host runtime to NocoBase `2.2.50`.

### `[0.2.0]` — 2026-11-22 — Single-Engine Architecture Upgrade & Enterprise Hardening (Waves 1–5)

- **Wave 1:** Fail-closed RBAC, cross-tenant IDOR prevention, SSRF/telemetry guards, and unified Single-Engine architecture on NocoBase + Apache-2.0 plugins.
- **Wave 2:** Zero-trust `infra/compose/prod.yml`, ephemeral full-stack DR rehearsal (`--ephemeral`), and DevSecOps CI gates.
- **Wave 3:** Composite indexes, `(organizationId, code)` uniqueness, optimistic locking (`409 VERSION_CONFLICT`), reversible migrations, non-blocking `SKIP LOCKED` Outbox + DLQ, Fetch SSE, and Enterprise Auth session cache + backchannel logout.
- **Wave 4:** Hybrid RAG (`tsvector` + RRF + `pgvector`), daily AI token/cost quotas (`429 AI_QUOTA_EXCEEDED`), Vietnamese PII redaction, `46/46` Vietnamese NL eval, and pure-SVG IIoT time-series charts with alert deduplication.
- **Wave 5:** Record Chatter, Immutable ERP Vouchers (`409 VOUCHER_IMMUTABLE`), column-RBAC CSV/XLSX/PDF export with formula-injection protection, GitOps Solution Bundle export/diff/import, and `Ctrl+K` Command Palette.

### Related Governance Pages

- [Pure-OSI `Apache-2.0` Policy & PoF Matrix](/en/oss/pure-osi-policy)
- [NocoBase `2.2.50` Clause 5.2 Attribution & Source Boundary](/en/oss/nocobase-clause-5-2)
- [CycloneDX 1.5 SBOM & Build from Source](/en/oss/sbom-and-build-from-source)
