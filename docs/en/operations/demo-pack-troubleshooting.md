---
title: Demo Pack, 15-Min Finals & Troubleshooting
description: Clean-install judge demo pack, minute-by-minute 15-minute finals walkthrough (v0.4.2), offline fallback commands, Q&A defense bank, and practical troubleshooting runbook.
---

# Clean-Install Demo Pack, 15-Min Finals & Troubleshooting (`v0.4.2`)

This runbook combines the **Clean-Install Judge Demo Pack**, the **0:00–15:00 Finals Presentation Script**, offline fallback commands, and practical operational troubleshooting — grounded strictly in **LatticeDX `v0.4.2`** (`12` Native v2 BlockModels, `56` static PostgreSQL `FORCE RLS` tables + dynamic `latticeCustom*`, `7` Apache-2.0 plugins on `nocobase/nocobase:2.2.50`, `257/257` CycloneDX SBOM components).

---

## Part 1 — Clean-Install Judge Demo Pack (`T-5 Min` Setup)

Verify Docker Desktop is running, then bootstrap an isolated clean NocoBase `2.2.50` instance (`0` initial tables) on port `13014`:

```sh
# 1. Clean-install NocoBase 2.2.50 + 7 Apache-2.0 plugins (0.4.2)
pnpm native:clean --port=13014

# 2. Seed Multi-Portal, Workspace, AI Workforce (7 profiles, 20 tools, MCP, A2A) & Showcase data
node scripts/setup-native-multi-portal-demo.mjs "<path-to-report.json>"
node scripts/setup-native-workspace-demo.mjs "<path-to-report.json>"
pnpm setup:dxos-ai -- --origin=http://localhost:13014
NOCOBASE_ADMIN_PASSWORD="<admin-password>" node scripts/seed-v030-demo-showcase.mjs --origin=http://localhost:13014
NOCOBASE_ADMIN_PASSWORD="<admin-password>" pnpm seed:v100-showcase -- --origin=http://localhost:13014
```

### Clean-Install Verification Checklist

1. Sign in at `http://localhost:13014` (`admin@nocobase.com` / `admin123`, local lab only) and open `/admin/pm/list` to confirm all **7 `@latticedx/*` plugins** are enabled at **`0.4.2`**:
   - `@latticedx/plugin-action-bridge` (`0.4.2`)
   - `@latticedx/plugin-lattice-foundation` (`0.4.2`)
   - `@latticedx/plugin-enterprise-auth` (`0.4.2`)
   - `@latticedx/plugin-dxos-para` (`0.4.2`)
   - `@latticedx/plugin-dxos-blocks` (`0.4.2`)
   - `@latticedx/plugin-dxos-studio` (`0.4.2`)
   - `@latticedx/plugin-dxos-ai` (`0.4.2`)
2. Confirm the footer preserves **NocoBase Clause 5.2** attribution (`Powered by NocoBase`, `v2.2.50`, `https://www.nocobase.com`, `License settings`).
3. Verify the **12 Native v2 BlockModels** under **UI Editor → `Add block`**:
   - `DxosPortalHeroBlockModel`, `DxosKpiMetricBlockModel`, `DxosContextTelemetryBlockModel`, `DxosAiProposalBlockModel`, `DxosWorkflowTasksBlockModel`, `DxosParaVaultBlockModel`, `DxosCreativeStudioBlockModel`, `DxosRecordWorkbenchBlockModel`, `DxosWebGisBlockModel`, `DxosKanbanScheduleBlockModel`, `DxosWmsOpsBlockModel`, `DxosBiChartBlockModel`.

### Browser Tabs Prepared for Demo

1. `http://localhost:13014/admin/settings/dxos-ai` — DX-OS AI Studio (9 tabs, 6-Plane Radar, 7 Profiles, 20 Tools, HITL, App Builder 2.0, Eval Lab)
2. `http://localhost:13014/admin/settings/dxos-studio` — Control Studio (11 tabs + 6 Governance Consoles + GitOps Bundle v3) & `/admin/settings/workflow/automation` (LatticeFlow v2: 24 node types, `dxos-architect` SSE chat)
3. `http://localhost:13014/p/logistics` — 5-step Logistics, `DxosWmsOpsBlockModel`, `DxosBiChartBlockModel`, Kanban/Schedule, PKI, QR SVG Voucher & `/v/track/:code`
4. `http://localhost:13014/p/incidents` — WebGIS MapLibre, 2-Way IIoT Digital Twin & GraphRAG Agent
5. `http://localhost:13014/p/cmms` & `http://localhost:13014/p/partner-claims` (`CLM-V100-001`)
6. `http://localhost:13014/v/mobile` — Mobile Field PWA (IndexedDB outbox + ePOD camera/signature)

### Reproducible Source Tarball Verification

Extract `output/release/latticedx-0.4.2-src.tar.gz` to a temporary directory **outside Git** (no `.git/`) to prove 100% self-contained OSS build reproducibility:

```sh
pnpm release:tarball
# In extracted directory:
pnpm install --frozen-lockfile
pnpm pof:check
pnpm release:sbom -- --check
pnpm check
node --test plugins/nocobase/*/tests/*.test.cjs scripts/tests/*.test.mjs tests/nocobase-externals.test.mjs
```

---

## Part 2 — 15-Minute Finals Walkthrough (`0:00 – 15:00`)

### `0:00 – 1:45` · Opening: 6-Plane DX-OS Open-Core & Pure-OSI Commitment
- **Screens:** `/admin/settings/dxos-ai` (Tab 1) -> `/admin/pm/list` -> system footer.
- **Narrative & Actions:**
  1. Present LatticeDX (`v0.4.2`) as a **6-Plane Digital Enterprise Operating System (`[H]–[P]–[D]–[I]`)** where NocoBase `2.2.50` serves as **Plane #6 (`appDataSubstrate`)**.
  2. Show all 7 `Apache-2.0` plugins (`0.4.2`, `sdkProvidedByHost: true`) live in `/admin/pm/list` alongside intact **NocoBase Clause 5.2** footer attribution.
  3. Highlight **100% Pure-OSI License Purity** (`0` BSL-1.1, no ThingsBoard/EMQX): `Valkey 8.1` (`BSD-3-Clause`), `Eclipse Mosquitto 2.0.21` (`EPL-2.0 OR BSD-3-Clause`), `Node-RED 4.0.9` (`Apache-2.0`), PostgreSQL 16 (`latticeTelemetryPoints` without separate TimescaleDB), Prometheus `v3.3.0`, and OTel Collector `0.123.0`.

### `1:45 – 4:15` · Plug-and-Play Cold-Chain OMS/WMS/FEFO/ePOD, Ed25519 PKI & Visual DMN
- **Screens:** `/p/logistics` -> `/admin/settings/dxos-studio` (6 Governance Consoles bar).
- **Narrative & Actions:**
  1. On `/p/logistics`, showcase `DxosKanbanScheduleBlockModel` (`ORD-V100-001` Can Tho -> HCMC, 7-day schedule view), `DxosWmsOpsBlockModel` (FEFO allocation / MKT hold / QA release / 2-phase bulk import), and `DxosRecordWorkbenchBlockModel`: verify **Ed25519 PKI & Merkle Ledger** (`dxosLedger:verify`), inspect **Data Lineage** (`dxosDataGov:lineageTrace`), and **Print ISO/IEC 18004 QR SVG Voucher** (`<iframe sandbox="" srcDoc>`) opening `/v/track/:code` (`dxosWms:verifyTrackSignature`, Zero-PII).
  2. In `/admin/settings/dxos-studio`, open **FEFO & ePOD Console** (`LOT-V100-FEFO-A` vs `LOT-V100-MKT-HOLD` locked by Arrhenius MKT) and **DMN Decision Tables Console** (`cold_chain_approval_v1`: `maxTempC: 9.5` -> `quality_hold_director`, 15m SLA, zero-`eval`).

### `4:15 – 8:45` · Closed-Loop Cold-Chain: LWT/Alarm -> Event Bus -> LatticeFlow v2 + DMN -> CMMS & Digital Twin HITL
- **Screens:** `/p/incidents` -> `/admin/settings/dxos-studio` (Broker & Vault/Automation) -> `/p/cmms` & `/p/partner-claims` -> `PortalAgentLauncher` -> `/admin/settings/dxos-ai` (Tab 8 (HITL)).
- **Narrative & Actions:**
  1. On `/p/incidents`, show `DxosWebGisBlockModel` (`COLD-CHILLER-CT-01`, `REEFER-TRUCK-HCM-02`, `COLD-HUB-DN-03`) and `DxosContextTelemetryBlockModel` (`8.9°C > 8°C` alert).
  2. In Control Studio:
     - **Broker & Events:** Show **Mosquitto DynSec** (`$CONTROL/dynamic-security/v1`, `allow_anonymous false`, per-tenant ACL `latticedx/<orgId>/<deviceKey>/*`), 2-way **FIWARE Orion-LD** subscriptions (`/ngsi-ld/v1/subscriptions` -> `dxosBroker:orionNotify`), and **CloudEvents 1.0 + Standard Webhooks** (`dxosEvents`: PG `SKIP LOCKED` outbox, HMAC `webhook-signature`, circuit breaker 5 failures/120s, DLQ replay).
     - **Vault & Automation:** Show **Connector Vault** (`dxosVault`, AES-256-GCM + OAuth2 PKCE S256 + SSRF allowlist), Stock `n8n` REST API v1 (`dxosN8n`), and `auto_cmms_on_coldchain_fault` evaluating DMN `cmms_priority_routing_v1`.
  3. Open `/p/cmms` and `/p/partner-claims` (`CLM-V100-001` from 1-click `coldchain-partner-settlement` pack), showing the created CMMS Work Order and `n8n` callback via `ldx_pat_*`.
  4. On `/p/incidents`, open `PortalAgentLauncher` and ask in Vietnamese to analyze chain impact for `COLD-CHILLER-CT-01` overheating -> triggers **`#16 dxos_graph_impact_analysis`** -> inspect **AI Studio Tab 8 (HITL)** (`dxosAi:triageScan`), demonstrating that setpoint changes `|delta| > 2.0°C` require human ACL approval (`dxosAi:approveAction`) before Node-RED dispatches MQTT downlink.

### `8:45 – 10:45` · Visual Domain Builder, 1-Click Tenant Provisioning, Mobile PWA (`/v/mobile`) & P.A.R.A. OCR
- **Screens:** `/admin/settings/dxos-studio` (Domain Builder & Tenant) -> `/v/mobile` -> `/p/services`.
- **Narrative & Actions:**
  1. Demonstrate creating a dynamic `latticeCustom*` entity (auto-provisions table + **PostgreSQL `FORCE RLS`**, live `/api/dxos:openapi`, RBAC, and `/p/*` route; **`56` static `FORCE RLS` tables** + dynamic `latticeCustom*`) and 1-click `dxosBuilder:provisionTenant` (org + Ed25519 key + default SLA + `ldx_admin`).
  2. Switch to `/v/mobile` (`390px` viewport): highlight `/api/dxos:sw.js` (`NetworkOnly` for `/api/*`), IndexedDB outbox + `quarantined` recovery + `512 KiB` photo/signature ePOD, and P.A.R.A. OCR/Hybrid RAG on `/p/services` and `/admin/settings/dxos-para`.

### `10:45 – 13:15` · Headless PaaS, GitOps Solution Bundle v3 & PoF / SBOM
- **Screens:** `/admin/settings/dxos-studio` (GitOps Bundle) + Terminal.
- **Narrative & Actions:**
  1. Export **`latticedx.solution-bundle/v3`** (`Schema · RBAC · Portals · Workflows · AI · Governance` with secrets redacted) and run Dry-Run Diff (`HTTP 200 PASS`).
  2. Run terminal verification against `:13014`:

```sh
curl -s http://localhost:13014/api/dxos:health
curl -s http://localhost:13014/api/dxos:openapi | head -n 30
pnpm acceptance:headless-paas -- --origin=http://localhost:13014
pnpm acceptance:dxos-ai-mcp -- --origin=http://localhost:13014
pnpm acceptance:broker-automation-builder -- --origin=http://localhost:13014
pnpm release:sbom -- --check
pnpm pof:check
```

### `13:15 – 15:00` · Negative RBAC (`403`) & Conclusion
- **Screens:** Sign out `root` -> sign in as `native.lab.employee@example.invalid` / `NativeLab-2026!`.
- **Narrative & Actions:**
  1. Confirm portal bar hides `/p/incidents` and `/admin/settings/*`; `/p/logistics` redirects to `/p/logistics-employee/...`; unauthorized calls to Admin Builder, Studio, Flow, Vault, or cross-org endpoints fail closed with **`HTTP 403`**.
  2. Close on dual readiness: **LatticeDX `v0.4.2`** delivers both **100% Pure-OSI PoF compliance** and a **production-hardened 6-Plane DX-OS**, cleanly reproducible from `latticedx-0.4.2-src.tar.gz`.

---

## Part 3 — Offline Fallback Commands & Jury Q&A Defense Bank

### Offline Fallback Commands (When External LLM / Network Is Unavailable)

```sh
# 1. PoF, SPDX headers (1,098 files), Compose digests & CycloneDX 1.5 SBOM (257/257)
node scripts/source-headers.mjs --check
pnpm pof:check
pnpm release:sbom -- --check
node --test scripts/tests/oss-pof-audit.test.mjs scripts/tests/generate-sbom.test.mjs scripts/tests/infra-compose-security.test.mjs

# 2. Offline Vietnamese NL Agent Eval (163/163 cases, 0 external API keys required)
node scripts/eval-vietnamese-nl-agent.mjs --min-pass=95

# 3. All 7 plugin unit & integration tests
node --test plugins/nocobase/*/tests/*.test.cjs

# 4. Local Headless PaaS & AI/MCP acceptance (if :13014 is running)
pnpm acceptance:headless-paas -- --origin=http://localhost:13014
pnpm acceptance:dxos-ai-mcp -- --origin=http://localhost:13014
```

### Jury Q&A Defense Bank

1. **Vendor lock-in or licensing conflict with NocoBase?**
   - No. All first-party code lives in **7 independent `Apache-2.0` plugins** with `"sdkProvidedByHost": true`. Both the Git repository and `latticedx-0.4.2-src.tar.gz` are **100% Pure-OSI** with zero `upstream/nocobase` submodule or `.gitmodules` — `nocobase/nocobase:2.2.50` runs solely as an external OCI runtime with Clause 5.2 attribution intact. Core contracts (`@dx/contracts`), Headless API (`apps/api`, `dxosApiKeys`, `dxosLedger`, `dxosDataGov`, `dxosWms`, `dxosDmn`), OpenAPI 3.1, AsyncAPI 3.0, and MCP operate independently of the UI.
2. **Why not use ThingsBoard, EMQX, or source-restricted Redis forks?**
   - Modern ThingsBoard, EMQX Enterprise, and source-available cache engines fail Pure-OSI compliance. LatticeDX uses **Valkey `8.1` (`BSD-3-Clause`, `PUBSUB_ADAPTER=redis`)**, **Eclipse Mosquitto `2.0.21` DynSec (`EPL-2.0 OR BSD-3-Clause`)**, **Node-RED `4.0.9` (`Apache-2.0`)**, and **PostgreSQL `16` (`latticeTelemetryPoints`)**, enforced automatically by `scripts/generate-sbom.mjs` (blocks `BSL-1.1`, `thingsboard`, `emqx`).
3. **What if a plugin developer forgets to filter `organizationId`?**
   - **Defense-in-Depth:** Beyond application-layer scope middleware (`before: 'latticeNativeScope'`), PostgreSQL connects as non-superuser **`nocobase_app`** with **`FORCE ROW LEVEL SECURITY` (`lattice_tenant_isolation`)** enabled on all **56 static `lattice*` tables + all dynamic `latticeCustom*` tables** via an `AsyncLocalStorage` transaction bridge (`set_config('app.current_org', ..., true)` fail-closed).
4. **Can an AI Agent hallucinate an unsafe cold-chain setpoint or self-approve orders?**
   - No. All write/control tools (`dxos_execute_record_action`, `dxos_alarm_action`, `dxos_twin_set_desired`, `dxos_wms_hold_lot`) are gated behind `latticeAiApprovalQueue` (enforcing `requesterUserId !== approver`). Digital Twin setpoint deltas **`|delta| > 2.0°C`** are hard-blocked into HITL until an ACL-authorized human approves (`dxosAi:approveAction`).
5. **What happens on `/v/mobile` if a driver loses 4G inside a cold storage warehouse?**
   - `/v/mobile` registers `/api/dxos:sw.js` (caching static shell only while keeping `/api/*` `NetworkOnly` to avoid token leakage) and stores `dxosWms:epodCapture` / `dxosBlocks:twinSetDesired` payloads in a bounded, prototype-sanitized **IndexedDB outbox**. Transient disconnects sync on reconnect; `400/404/422` validation errors move to **`quarantined`** (preserving ePOD photos/signatures for edit-and-retry); `401` pauses immediately on the first auth failure without data loss.

---

## Part 4 — Practical Troubleshooting Runbook

| Symptom | Root Cause | Resolution |
| --- | --- | --- |
| **AI Agent returns `503` using `combo` alias** | One upstream provider in `9router` (`localhost:20128`) `combo` exhausted quota or errored. | Switch the profile model to a healthy provider (e.g. `ag/gemini-3.8-flash` or run `node scripts/setup-department-ai-agent.mjs --origin=http://localhost:13014 --model=ag/gemini-3.8-flash`). Note: in `v0.4.2`, closed portals suppress `503` toast spam and chat shows a Retry card. |
| **`ai-employee` workflow missing from `Add tool`** | Workflow is not enabled (`On`), lacks `sync: true`, or has no `Output` node. | Enable `Synchronously` (`sync: true`), toggle `On`, add `Output` node, and trigger `workflows:sync` (or re-run `setup-department-ai-agent.mjs`). |
| **`Cannot remove a UI manageable field` error** | Target collection has `uiManageable: true`. | Temporarily set `uiManageable: false`, call `collections/<name>/fields:destroy`, then restore `uiManageable: true`. |
| **`node scripts/source-headers.mjs --check` fails** | Newly created file is missing the `@copyright (C) 2026 CTU-OpenPaw` + `SPDX-License-Identifier: Apache-2.0` header. | Add the standard file header or run `node scripts/source-headers.mjs --write` for SPDX-tagged files. |
| **`/api/dxos:metrics` returns `401` or `403`** | Missing/mismatched `DX_METRICS_TOKEN` or user lacks `root` / `ldx_admin` role. | Supply `Authorization: Bearer <DX_METRICS_TOKEN>` (matching `nocobase` container env) or authenticate as `root` / `ldx_admin`. |
| **Windows `VirtualAlloc ... errno=1455` during `pnpm check`** | Concurrent monorepo builds + tests hit Windows pagefile limit. | Run sequentially instead of concurrently: `pnpm typecheck && pnpm test && pnpm -r --workspace-concurrency=1 build`. |
| **`/v/mobile` items stuck in `quarantined` or `401` paused** | Order code typo (`400/404/422`) or expired JWT (`401`). | For `quarantined`: click **Edit order code** and retry, or **Export JSON** backup. For `401`: click **Sign in now** — IndexedDB preserves all queued ePODs. |
| **`stack-recovery.mjs` refuses `rehearse` or `restore`** | Missing `--confirm-restore=<stack-id>`, symlinked bundle path, or SHA-256 mismatch. | Pass the exact `stack-<32hex>` folder name to `--confirm-restore=`, keep bundles inside a real non-symlinked `output/backups/stack/` directory, and verify checksums before retrying. |

---

## Related Documentation

- [Pure-OSI & Apache-2.0 Policy](/en/oss/pure-osi-policy)
- [NocoBase 2.2.50 Attribution (Clause 5.2)](/en/oss/nocobase-clause-5-2)
- [CycloneDX SBOM & Build-from-Source](/en/oss/sbom-and-build-from-source)
- [Observability, OTel GenAI & Alerting](/en/operations/observability)
- [Full-Stack Backup, PITR WAL Archiving & DR](/en/operations/backup-pitr-dr)
- [Complete Automated & E2E Testing Guide](/en/operations/testing-e2e-guide)
