---
title: Complete Automated & E2E Testing Guide
description: Full end-to-end verification guide for LatticeDX v0.4.2 covering clean-install bootstrap, 8 testing domains, 5 authenticated roles + anonymous guest, 124/124 E2E, 2,509 unit/integration tests, and 163/163 Vietnamese NL Eval.
---

# Complete Automated & E2E Testing Guide (`v0.4.2`)

This guide mirrors the official end-to-end QA specification (`docs/E2E_TESTING_GUIDE_HUNG.md` in `CTU-OpenPaw/lattice-dx`) and documents how to spin up a clean `v0.4.2` stack from scratch and verify all **8 domains**, **5 authenticated roles + anonymous guest**, **12 Native v2 BlockModels**, **Mobile Field PWA (`/v/mobile`)**, **Public Portals (`/v/form/*`, `/v/track/*`)**, **P.A.R.A. OCR/RAG**, **DX-OS AI Studio (9 tabs)**, **Control Studio (11 tabs + 6 Governance Consoles)**, **LatticeFlow v2 (24 node types)**, and the full automated/compliance test suite.

---

## Verified `v0.4.2` Test & Compliance Baselines

| Suite / Gate | Verified Result | Command / Scope |
| --- | :---: | --- |
| **Monorepo Typecheck + Vitest + Build** | **`1,128 / 1,128`** (`152` Vitest files) | `pnpm check` (`pnpm typecheck && pnpm test && pnpm build`) |
| **Plugin, Script & External Node Tests** | **`1,381 / 1,381`** (`174` test files) | `node --test plugins/nocobase/*/tests/*.test.cjs scripts/tests/*.test.mjs tests/*.test.mjs` |
| **Combined Unit & Integration Total** | **`2,509 / 2,509`** | Vitest + `node --test` |
| **Live Docker Playwright & API E2E** | **`124 / 124 PASS`** | Live clean-install Docker E2E (`Tier 5 NO_GAPS`) |
| **Vietnamese NL Agent Eval Lab** | **`163 / 163 (100%)`** | `node scripts/eval-vietnamese-nl-agent.mjs --min-pass=95` (23 categories, 30 `security-refusal` cases) |
| **SPDX Headers & PoF Readiness** | **`1,098` files · `6 / 6 PASS`** | `node scripts/source-headers.mjs --check && pnpm pof:check` |
| **CycloneDX 1.5 SBOM & Audit** | **`257 / 257` (`0 NONE`, `0` prod CVEs)** | `pnpm release:sbom -- --check && pnpm audit --prod --audit-level=low` |

---

## 0. Environment Setup & Clean-Install Stack (5–10 Minutes)

### 0.1 Prerequisites

- **Node.js `24.x`** (`>=24 <25`), **pnpm `10.23.0`**, **Git**, and **Docker Desktop** running (Linux containers).
- **Chrome or Edge** (keep an **Incognito / InPrivate** window ready for anonymous public portal flows and multi-account switching without session bleed).

### 0.2 Install Dependencies & Bootstrap Clean Stack

```powershell
git pull origin main
pnpm install --frozen-lockfile

# 1. Boot a clean NocoBase 2.2.50 host (0 initial tables) + 7 Apache-2.0 plugins (0.4.2) on port 13014
pnpm native:clean --port=13014
```

Save the `report.json` path printed by `pnpm native:clean` and substitute it for `<path-to-report.json>` below:

```powershell
# 2. Provision Multi-Portal + Workspace + demo personnel
node scripts/setup-native-multi-portal-demo.mjs "<path-to-report.json>"
node scripts/setup-native-workspace-demo.mjs "<path-to-report.json>"

# 3. Seed 7 Starter AI Profiles, 20 Unified Tools, MCP Gateway & A2A
pnpm setup:dxos-ai -- --origin=http://localhost:13014

# 4. Seed Cold-Chain, OMS/WMS/FEFO, PKI, DMN, P.A.R.A., Public Forms & Showcase data
$env:NOCOBASE_ADMIN_PASSWORD = "<admin-password>"
node scripts/seed-v030-demo-showcase.mjs --origin=http://localhost:13014
pnpm seed:v100-showcase -- --origin=http://localhost:13014
```

::: tip Testing Blank-Slate Onboarding (Zero Demo Data)
To verify the empty-state onboarding checklist and blank-slate App Builder lifecycle check, run:
```powershell
$env:LATTICE_SKIP_DEMO_SEED = "1"
pnpm native:clean --port=13014 --blank-slate
```
:::

### 0.3 Test Accounts (`http://localhost:13014`)

> **Local lab credentials only** — never expose demo fixture passwords outside local isolated environments.

| Role | Email / Account | Default Password | Test Scope |
| --- | --- | --- | --- |
| **Root Admin (`root`)** | `admin@nocobase.com` | `admin123` | Full AI Studio, Control Studio, Flow Studio, P.A.R.A., UI Editor, multi-org |
| **Manager (`ldx_manager`)** | `native.lab.manager@example.invalid` | `NativeLab-2026!` | Approvals, WMS FEFO, Incidents, Manager portals, privilege separation vs Admin |
| **Employee (`ldx_employee`)** | `native.lab.employee@example.invalid` | `NativeLab-2026!` | Employee portal redirect (`/p/logistics-employee/...`), `403` blocks on Flow/AI/Control Studio |
| **Dispatcher (`ldx_dispatcher`)** | `native.lab.dispatcher@example.invalid` | `NativeLab-2026!` | Logistics dispatch, lot allocation & ePOD coordination |
| **Driver (`ldx_driver`)** | `native.lab.driver@example.invalid` | `NativeLab-2026!` | Mobile Field PWA `/v/mobile`, offline ePOD capture, Digital Twin ACL hiding |
| **Anonymous Guest** | *(Unauthenticated — Incognito window)* | — | `/v/form/:slug`, `/v/track/:code?verify=...`, `/signin` |

---

## 1. Domain 1 — Auth, Onboarding & Public Portals

### Test 1.1: Clean `/signin` & Localized Errors
1. Open an **Incognito** window with **DevTools → Network & Console** open and visit `http://localhost:13014/signin`.
2. **Expected:** Zero `401` request storms (`aiEmployees`/`aiConversations` do not auto-fire when unauthenticated) and no public self-registration link.
3. Submit invalid credentials (`admin@nocobase.com` / `wrong-pass`).
4. **Expected:** Localized Vietnamese validation error message (no raw English exception leak).

### Test 1.2: Root Auto-Redirect & NocoBase Clause 5.2 Attribution
1. Sign in as `admin@nocobase.com` / `admin123`.
2. **Expected:** Redirects directly to `/admin/lattice-workspace` with portal shortcuts (`/p/*`) and DX-OS Approval Inbox (no blank `"No pages yet, please configure first"` screen).
3. Confirm the footer preserves NocoBase **Clause 5.2** attribution (`Powered by NocoBase`, `v2.2.50`, `https://www.nocobase.com`, `License settings`).

### Test 1.3: Enterprise SSO Settings (`/admin/settings/auth/enterprise-mappings`)
1. Open `/admin/settings/auth/enterprise-mappings`.
2. **Expected:** Renders cleanly (no HTTP `500`), displays clean status/warning when Keycloak is offline, uses friendly pickers instead of raw UUIDs, and enforces `Popconfirm` before deletion.

### Test 1.4: Public Forms (`/v/form/:slug`) — Attachments, Lookup & XSS Defense
1. In Incognito, open `/v/form/yeu-cau-dich-vu-nhanh` (or a form created in Domain 6).
2. Submit with missing required fields -> **Expected:** Inline Vietnamese validation errors, zero `401`/`403`/`404` console/network errors for logo or favicon.
3. Fill all fields, inject `<img src=x onerror=alert(1)>` into the description, attach a small image/PDF, and click **Submit**.
4. **Expected:** Submission succeeds, displays **Tracking Code** + **Copy Code** + **"Gửi hồ sơ khác"**; zero XSS execution; manual lookup returns Zero-PII status only.

### Test 1.5: Ed25519 QR Order Tracking (`/v/track/:code?verify=...`)
1. As Admin/Manager on `/p/logistics`, open **WMS Ops** and click **Print QR Voucher** for confirmed order `ORD-V100-001` (not a draft order).
2. Open the generated `/v/track/LDX-TRK-...?verify=...` URL in Incognito.
3. **Expected:**
   - Pre-fills the tracking code and displays a valid **public Ed25519 ledger signature verification**.
   - Private ePOD/PII fields remain **fail-closed** until the correct `trackingToken` is entered (with an eye toggle button).
   - At Mobile viewport (`390x844`), all interactive buttons measure at least `44x44px` with no clipping.

### Test 1.6: Legacy Compatibility Breadcrumb (`/lattice/workspace`)
- Visit `/lattice/workspace` (when bridge routes are active) -> displays the **"← Quay lại Workspace v2"** breadcrumb back to v2 Workspace.

---

## 2. Domain 2 — 7 Business Portals & 12 Native v2 BlockModels

### Test 2.1: Multi-Portal Cockpit Verification (`1440x900` & `1280x800`)

1. **`/p/logistics`:**
   - **WmsOpsBlock (`DxosWmsOpsBlockModel`):** As `root`, select `organizationId` (`native-ui-lab`), test **FEFO Allocation** (zero `400` errors), trigger **MKT Hold (`holdLotByMkt`)** on a lot and **QA Release (`releaseLotByQa`)**, and verify printing a voucher on a **draft** order produces a clear localized error.
   - **Kanban & 7-Day Schedule (`DxosKanbanScheduleBlockModel`):** Toggle between Kanban and 7-day schedule (`+07:00` timestamps), open the detail drawer, and trigger an Approval CTA.
   - **BiChart (`DxosBiChartBlockModel`):** Switch through all 5 chart modes (**Bar / Line / Pie / KPI / Pivot**) verifying SQL `aggregateQuery`; open **Content Config** and confirm the modal anchors near the top (`top: 24px`) without top-edge clipping and displays human-readable labels.
   - **Record Workbench (`DxosRecordWorkbenchBlockModel`):** Verify Chatter, **Ed25519 PKI** badge, **Lineage** drawer, **Print Voucher** (`<iframe sandbox="" srcDoc>`), and Unicode **CSV / XLSX / PDF** export.
2. **`/p/incidents`:**
   - **WebGIS (`DxosWebGisBlockModel`):** Verify cold-chain assets `COLD-CHILLER-CT-01`, `REEFER-TRUCK-HCM-02`, and `COLD-HUB-DN-03`; open **Digital Twin Control** and submit a temperature delta `> 2.0°C` -> confirm escalation to the AI HITL queue.
   - **AI Proposals & Workflow Tasks (`DxosAiProposalBlockModel`, `DxosWorkflowTasksBlockModel`):** Verify direct Approve / Reject buttons execute real mutations.
3. **`/p/services`:**
   - **P.A.R.A. Vault (`DxosParaVaultBlockModel`):** Open an SOP document and verify `contentMarkdown` renders completely, pagination works, and `draft`/`archived` docs remain hidden.
4. **`/p/procurement`, `/p/cmms`, `/p/partner-claims` (`CLM-V100-001`):**
   - Load cleanly with zero blank screens, full Vietnamese localization, and zero `503 local-9router` toast spam when AI chat is closed.
5. **Global Topbar & Block Catalog:**
   - Press `Ctrl+K` (Command Palette) -> query by order/document code (`globalSearch`) and navigate directly to a match.
   - Click the **Notification Bell** -> verify unread badge, `markRead` / `markAllRead`, and deep links.
   - Enable **UI Editor → `Add block`** -> confirm all **12 Native v2 BlockModels** are registered.

### Test 2.2: Employee RBAC & Automatic Redirect (`ldx_employee`)
1. Sign out `root` and sign in as `native.lab.employee@example.invalid` / `NativeLab-2026!`.
2. Navigate directly to `/p/logistics` -> **Expected:** Automatically redirects to `/p/logistics-employee/...` (scoped to own orders).
3. Verify the Topbar hides unauthorized portals, and manually navigating to `/admin/settings/dxos-studio`, `/admin/settings/dxos-ai`, or `/admin/settings/workflow/automation` is blocked with **`403`**.

---

## 3. Domain 3 — Mobile Field PWA (`/v/mobile`)

Open DevTools **Device Toolbar** at **`390 x 844`** and sign in as Driver (`native.lab.driver@example.invalid` / `NativeLab-2026!`), then open `/v/mobile`:

1. **Manifest, Service Worker & ACL:**
   - In **DevTools → Application**, verify `/api/dxos:manifest` (with `192x192` & `512x512` PNG icons) and Service Worker `/api/dxos:sw.js` (`NetworkOnly` for `/api/*`).
   - Confirm primary touch targets are `>= 44x44px` with no horizontal overflow, and the **Digital Twin** tab is cleanly hidden by ACL (no raw `403 DXOS_ACL_DENIED` flash).
2. **Offline ePOD Capture (Cold Storage Without GPS):**
   - Set DevTools **Network** to **`Offline`**.
   - In the ePOD tab, enter `ORD-V100-001`, check **Cold-storage GPS unavailable (`gpsUnavailable`)**, attach a photo + draw a canvas signature, and save. Also create an offline incident/service ticket.
   - **Expected:** Both payloads persist safely in the IndexedDB **Outbox** with pending item count shown.
3. **Quarantine Preservation on `400/404/422`:**
   - Queue another offline ePOD with a nonexistent order code (`ORD-KHONG-TON-TAI-999`).
   - Switch Network back to **`Online`** and click **Sync Now**.
   - **Expected:** Valid ePOD syncs cleanly; the invalid-order item is **never deleted** — it moves to **`quarantined`** with the server error message and options to **Edit order code & retry**, **Export JSON backup**, or **Manually delete**.
4. **Session Expiry (`401`) & Offline LLM Chat:**
   - Corrupt/clear the token in `localStorage` and trigger Sync -> **Expected:** Halts on the first `401` (no `401` storm), keeps the ePOD payload intact in Outbox, and prompts **Sign in now**.
   - Send an AI chat message while `9router` is stopped -> **Expected:** Renders an error card with a **Retry** button rather than hanging indefinitely.

---

## 4. Domain 4 — P.A.R.A. Knowledge Vault, OCR-to-Record & Hybrid RAG

Sign back in as `root` (`admin@nocobase.com` / `admin123`) and open `/admin/settings/dxos-para`:

1. **`active` vs `draft`/`archived` Hybrid Search:**
   - Create one `status = active` document and one `status = draft` document.
   - Click **Reindex**, then search for keywords from the `draft` document -> **Expected:** `draft` document is **excluded**.
   - Search a nonexistent token (`xyz_khong_ton_tai_99999`) -> **Expected:** Returns an **empty result set** (no fabricated RRF scores).
   - Verify `summary` masks sensitive PII (CCCD / phone numbers).
2. **OCR-to-Record Field Fidelity (`latticeStockLots`):**
   - Upload a `.txt` / `.docx` / `.xlsx` receiving slip, click **OCR Extract**, select target collection `latticeStockLots`, edit `productName`, `qtyOnHand`, and `lotCode`, and click **Create Record from OCR**.
   - **Expected:** The persisted database row matches your exact edited values without silent overwrites.

---

## 5. Domain 5 — DX-OS AI Studio (9 Tabs), App Builder 2.0, MCP & Eval Lab

Open `/admin/settings/dxos-ai` and inspect all 9 tabs:

1. **Tab 1 (Overview & Quick-Connect LLM):** Verify `dxosAi:listLlmServices` and confirm SSRF protection blocks internal targets (`http://127.0.0.1`, `http://169.254.169.254`) via `redirect: 'error'` + DNS SSRF guard.
2. **Tab 2 (AI Workforce — 7 Starter Profiles):** Confirm all 7 starter profiles and 6 configuration fields; create/edit a test profile.
3. **Tab 3 (2-Way Enterprise MCP & A2A):** Verify live tool catalog, click **Ping MCP**, and inspect `/.well-known/agent-card.json` (version `0.4.2`).
4. **Tab 6 (AI HITL Queue):** Confirm status filters (`pending`, `approved`, `rejected`, `executing`, `failed`), `executionResult`, and `expiresAt`.
5. **Tab 7 (Built Apps Manager — App Builder 2.0):** Run **Plan** (inspect Visual ER Graph & Plan-Diff) -> **Build** -> **Patch** -> **Rollback** (verifying rollback only touches `blockUids` owned by that app) -> **Teardown** (with `keepData` confirmation protecting cross-tenant tables).
6. **Tab 8 (Trace Waterfall & Eval Lab):** Select suite `vietnamese-nl-agent` (`mode: router`) and run -> **Expected:** Executes all **`163 / 163` cases (`100%`)**.
7. **Tab 9 (Quota Policy & Audit Logs):** Save a token/cost quota policy, reload to confirm PostgreSQL persistence (`latticeAiQuotaPolicies` with `FORCE RLS`), and verify Audit Log dropdown filters trigger fresh server queries with `+07:00` timestamps.

---

## 6. Domain 6 — Control Studio (11 Tabs + 6 Governance Consoles)

Open `/admin/settings/dxos-studio` at both `1440x900` and `1280x800`:

1. **Deep-Linking & Responsive Layout:** Open `/admin/settings/dxos-studio?tab=dmn` (lands directly on DMN Decision Tables). Check `dmn`, `broker`, `automation`, and `data-gov` at `1280x800` -> horizontal scroll is clean with zero clipped action buttons.
2. **Omnichannel Notifications (`dxosNotify`):** Inspect `smtp`, `telegram`, `slack`, and `webhook` channels, run `testSend`, and verify `logs`.
3. **Public Form Builder:** Create a form with a `select` field (`options` + `maxLength`/`pattern`), save cleanly (no `400`), test **Live Preview**, and inspect submitted rows in `dxosForms:listSubmissions`.
4. **Visual DMN Editor:** Edit a rule in `cold_chain_approval_v1` **without saving** and click **Simulate** -> evaluates against the live unsaved draft; verify all 4 hit policies (`FIRST`, `COLLECT`, `UNIQUE`, `PRIORITY`).
5. **Unified Approval Inbox:** Switch across all 4 tabs (`business`, `ai_hitl`, `flow`, `proposals`) -> badge counts remain accurate without resetting to `0`; test `review`, `diffPreview`, and the Approval Policy drawer.
6. **PKI & Merkle Ledger (`dxosLedger`):** Run `verify` (valid), trigger `rotateKey` (legacy signatures using `expectedKeyId` continue to validate), and export Merkle Proof JSON.
7. **PaaS API Keys (`ldx_pat_*`) & Outbox/DLQ:** Issue a scoped PAT via role dropdown, verify one-time **Copy** button, revoke it, and inspect `payloadJson` + replay in Outbox/DLQ.
8. **GitOps Solution Bundle v3:** Export Bundle JSON (contains `latticeConnectors` with secrets redacted), re-upload via `<input type="file">`, and run **Dry-Run Diff** -> **`HTTP 200 PASS`**.

---

## 7. Domain 7 — LatticeFlow v2 Workflow Automation Studio

Open `/admin/settings/workflow/automation` as `root` or `ldx_manager`:

1. **RBAC Isolation:** Confirm `ldx_employee` receives `403` on UI and `dxosAutomations` API calls (`listRules`, `listRuns`).
2. **Canvas-First Editor & 24 Node Types (6 Groups):**
   - Drop 2 Trigger nodes onto the canvas -> immediate localized client-side warning (matched by server validator).
   - Inspect `ai.agent` (`aiEmployee`, `model`, `temperature`, `maxTokens`, `memoryScope`).
   - Verify visual row builders for `control.if`, `control.switch`, and `logic.transform`.
   - Configure `trigger.schedule` with `Asia/Ho_Chi_Minh` and toggle `toggleRule` -> verify `nextRunAt`.
3. **Dry Run, Versioning & Durable Resume:**
   - Run **Dry Run** -> inspect node-level Live Trace I/O JSON and **Copy-cURL** on webhooks.
   - Publish -> edit to Draft -> verify version history and **Rollback**.
   - Execute a flow containing `control.loop` with an inner `control.approval` (HITL), approve in Unified Inbox -> confirm `loopCursor` resumes remaining iterations and fires `done`.
   - Execute a parallel branch into `control.merge` (`mode: 'first_completed'`) -> confirm the fast branch proceeds without blocking on the slow branch.

---

## 8. Domain 8 — Automated CLI, Live Acceptance & Pure-OSI Checks

Run these commands from the `lattice-dx` repository root:

```powershell
# 1. Monorepo typecheck + Vitest (152 files / 1,128 tests) + 12 workspace/plugin builds
pnpm check

# 2. All 7 plugin tests + script tests + external boundary tests (174 files / 1,381 tests)
$files = @(
  Get-ChildItem -Path "plugins\nocobase\*\tests\*.test.cjs" -File | Select-Object -ExpandProperty FullName
  Get-ChildItem -Path "scripts\tests\*.test.mjs" -File | Select-Object -ExpandProperty FullName
  Get-ChildItem -Path "tests\*.test.mjs" -File | Select-Object -ExpandProperty FullName
)
node --test --test-concurrency=4 @files

# 3. Vietnamese Natural Language Agent Eval (163/163 = 100%)
node scripts/eval-vietnamese-nl-agent.mjs --min-pass=95

# 4. Pure-OSI, SPDX headers (1,098 files), PoF (6/6), CycloneDX 1.5 SBOM (257/257) & CVE audit (0 vulns)
node scripts/source-headers.mjs --check
pnpm pof:check
pnpm release:sbom -- --check
pnpm audit --prod --audit-level=low

# 5. Live API/E2E acceptance suites (with runtime running on http://localhost:13014)
pnpm acceptance:headless-paas -- --origin=http://localhost:13014
pnpm acceptance:dxos-ai-mcp -- --origin=http://localhost:13014
pnpm acceptance:broker-automation-builder -- --origin=http://localhost:13014
pnpm acceptance:logistics-rbac -- "<path-to-report.json>"

# 6. Full-stack backup & non-destructive ephemeral rehearsal
pnpm backup:stack
node scripts/stack-recovery.mjs rehearse "output/backups/stack/stack-<id>" --ephemeral
```

### Live Acceptance Coverage Summary

| Script | Verified Scope |
| --- | --- |
| `pnpm acceptance:headless-paas` | Scoped `ldx_pat_*` keys, Ed25519/Merkle PKI ledger, scoped role delegations, QR SVG + non-PII `/v/track`, Arrhenius MKT & freeze snapshots |
| `pnpm acceptance:dxos-ai-mcp` | 7 AI Profiles, 20 Unified Tools, `/api/dxos-mcp` + `/api/dxos-mcp/it-ot` prompts/resources, App Builder 2.0, HITL execution, quota & audit |
| `pnpm acceptance:broker-automation-builder` | Mosquitto DynSec + LWT, Orion-LD 2-way subscriptions, CloudEvents + Standard Webhooks, AES-256-GCM Connector Vault + OAuth2 PKCE, Stock `n8n` v1, LatticeFlow v2 DAG + DMN, Domain Builder + `FORCE RLS` |
| `pnpm acceptance:logistics-rbac` | 5-step Logistics workflow, role boundaries across `ldx_manager`/`ldx_employee`/`ldx_dispatcher`/`ldx_driver`, cross-tenant denial |

---

## 9. E2E Sign-Off Matrix & Cleanup

| # | Domain | Key Gate |
| :---: | --- | --- |
| 1 | Auth, Onboarding & Public (`/signin`, `/v/form/*`, `/v/track/*`) | Zero `401` noise on `/signin`; `root` -> `/admin/lattice-workspace`; QR `?verify=` Ed25519 proof without PII leak; `/v/form` file upload + XSS defense |
| 2 | 7 Portals & 12 BlockModels | `ParaVault` Markdown; `WmsOps` `releaseLotByQa` + org picker; `BiChart` modal unclipped; direct `AiProposal`/`WorkflowTasks` actions; `Ctrl+K` + Bell |
| 3 | Mobile Field PWA `/v/mobile` (`390x844`) | Offline ePOD + `gpsUnavailable`; `400/404` -> `quarantined` (zero data loss); `401` pauses outbox; Digital Twin hidden by ACL; `>= 44px` targets |
| 4 | P.A.R.A. & OCR-to-Record | `status='active'` filtering; nonsense query returns `[]`; OCR `latticeStockLots` preserves user edits |
| 5 | DX-OS AI Studio (9 Tabs) & Chat | Eval Lab `163/163`; server-side Audit filters; HITL `executionResult`/`expiresAt`; scoped app rollback; multi-tenant safe teardown |
| 6 | Control Studio (11 Tabs + 6 Consoles) | Full `dxosNotify` UI; Form `select` + Submissions Viewer; DMN draft simulation; 4-tab badge persistence; PKI `rotateKey`; GitOps Dry-Run `200 PASS` |
| 7 | LatticeFlow v2 Studio | `ldx_employee` `403` isolation; localized validators; `ai.agent` full fields; visual `if`/`switch`/`transform`; `control.loop` HITL resume; `first_completed` |
| 8 | CLI Automated & Pure-OSI | `pnpm check`, `node --test`, `163/163` Eval, `pof:check` `6/6`, `sbom` `257/257`, `audit` `0` CVEs, `acceptance:*` |

### Clean Teardown After Testing

```powershell
# Stop clean-install Docker stack when finished (keep host free of orphan containers)
docker compose -f infra/compose/nocobase.yml down
# Or for a pnpm native:clean project:
docker compose -p "<clean-project-name>" down -v --remove-orphans
```

---

## Related Documentation

- [Multi-Portal & 12 BlockModels v2](/en/modules/multi-portal-blocks)
- [LatticeFlow v2 DAG Engine](/en/modules/latticeflow-v2)
- [Pure-OSI & Apache-2.0 Policy](/en/oss/pure-osi-policy)
- [Observability, OTel GenAI & Alerting](/en/operations/observability)
- [Full-Stack Backup, PITR WAL Archiving & DR](/en/operations/backup-pitr-dr)
- [Clean-Install Demo Pack, 15-Min Finals & Troubleshooting](/en/operations/demo-pack-troubleshooting)
