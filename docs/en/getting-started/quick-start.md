---
title: Quick Start
description: Build LatticeDX v0.4.2 from source, run the 1-command clean install with pnpm native:clean, compare blank-slate vs demo seed modes, and explore the landing portals.
---

# Quick Start (`v0.4.2`)

This guide walks you through obtaining **LatticeDX `v0.4.2`**, verifying the TypeScript workspace and 7 Pure-OSI NocoBase plugins, and booting an isolated clean-install environment in **one command** via `pnpm native:clean`.

## 1. Obtain the Source Code

Choose either the official Git repository or the self-contained release source tarball.

::: code-group

```sh [Git Clone]
git clone https://github.com/CTU-OpenPaw/lattice-dx.git
cd lattice-dx
```

```sh [Release Tarball]
sha256sum -c latticedx-0.4.2-src.tar.gz.sha256
tar -xzf latticedx-0.4.2-src.tar.gz
cd latticedx-0.4.2
```

:::

::: info Zero Embedded Upstream Source
Neither the Git repository nor `latticedx-0.4.2-src.tar.gz` contains `.gitmodules` or `upstream/nocobase/`. No `git submodule` step is required. The external host runtime (`nocobase/nocobase:2.2.50`) is pulled only as a digest-pinned OCI container when Docker runs.
:::

## 2. Install Workspace Dependencies & Run Offline Checks

Install locked workspace packages and verify TypeScript compilation, unit tests, and package builds:

```sh
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` executes three sequential stages:
1. `pnpm typecheck` — `pnpm -r typecheck` across `@dx/contracts`, `@dx/api`, `@dx/agent-worker`, `@dx/file-scanner`, plus `tsc -p solutions/logistics/tsconfig.json`.
2. `pnpm test` — `vitest run --maxWorkers=4`.
3. `pnpm build` — `pnpm -r build` compiling all workspace packages.

### Building & Testing the 7 NocoBase Plugins (`0.4.2`)

If you want to build and test all 7 `Apache-2.0` NocoBase plugins locally outside Docker (for example during plugin development or CI verification):

```sh
# 1. Restore locked MIT OIDC dependencies for plugin-enterprise-auth (lifecycle scripts disabled)
npm ci --prefix plugins/nocobase/plugin-enterprise-auth --ignore-scripts --no-audit --no-fund

# 2. Build all 7 plugins (each declares "sdkProvidedByHost": true for NocoBase 2.2.50)
node plugins/nocobase/action-bridge/build.mjs
node plugins/nocobase/plugin-lattice-foundation/scripts/build.mjs
node plugins/nocobase/plugin-enterprise-auth/build.mjs
node plugins/nocobase/plugin-dxos-para/build.mjs
node plugins/nocobase/plugin-dxos-blocks/build.mjs
node plugins/nocobase/plugin-dxos-studio/build.mjs
node plugins/nocobase/plugin-dxos-ai/build.mjs

# 3. Run all plugin & script unit tests + Vietnamese NL eval (163/163 cases)
node --test plugins/nocobase/*/tests/*.test.cjs scripts/tests/*.test.mjs tests/nocobase-externals.test.mjs
node scripts/eval-vietnamese-nl-agent.mjs --min-pass=95
```

## 3. One-Command Clean Install (`pnpm native:clean`)

Ensure Docker Engine / Docker Desktop is running (see [Requirements & Sizing](/en/getting-started/requirements)), then launch a clean isolated runtime on localhost port `13014` (any port from `13004` to `13999` is accepted; default is `13004`):

```sh
pnpm native:clean --port=13014
```

### What `scripts/native-clean-install.mjs` Automates

1. **Collision Guard:** Generates a unique 12-hex project ID (`lattice-native-clean-<id>`) and verifies zero pre-existing containers, volumes, or networks share that project label.
2. **Committed Source Export:** Runs `git archive` from committed `HEAD` into `output/native-clean/<id>/source` and extracts `source.tar`. Uncommitted local files and local database dumps are never copied.
3. **Empty Database Proof:** Boots an isolated `pgvector/pgvector:0.8.1-pg16` (`nocobase-db`) container and asserts `SELECT count(*) FROM pg_tables WHERE schemaname='public'` equals **`0`**.
4. **Host Bootstrap & Pre-Install Backup:** Starts `nocobase/nocobase:2.2.50` bound strictly to `127.0.0.1:<port>`, waits for `/api/app:getLang`, and captures a pre-workspace custom-format `pg_dump` under `output/native-clean/<id>/backups/`.
5. **Plugin Build, Pack, Install & Upgrade:** Builds all 7 plugins inside the exported source directory, packs each plugin offline (`npm pack --offline --ignore-scripts`), installs and enables all 7 `@latticedx/*` packages via `yarn nocobase pm add` + `pm enable`, runs `yarn nocobase upgrade`, and verifies `@nocobase/server` `2.2.50` plus all `@latticedx/*` database migrations.
6. **Automated Acceptance & Report:** Runs `acceptance-native-foundation.mjs`, `acceptance-native-documents.mjs`, and `setup-native-ui-lab.mjs`, then outputs a JSON summary including `reportPath` (`output/native-clean/<id>/report.json`) and `pageUrl`.

## 4. Blank-Slate Mode (`LATTICE_SKIP_DEMO_SEED=1`) vs Demo Seed

`pnpm native:clean` supports two distinct initialization profiles depending on whether you want a clean zero-data enterprise skeleton or a pre-populated showcase environment.

### Mode A: Blank-Slate Verification (`--blank-slate`)

Passing `--blank-slate` injects `LATTICE_SKIP_DEMO_SEED: "1"` into the generated Compose overlay (`output/native-clean/<id>/overlay.yml`):

```sh
# Run blank-slate verification and auto-clean containers afterward
pnpm native:clean --port=13014 --blank-slate

# Or keep the blank-slate runtime running on http://localhost:13014
pnpm native:clean --port=13014 --blank-slate --keep
```

In `--blank-slate` mode, `scripts/native-clean-install.mjs` verifies:
- **Zero Demo Business Rows:** `latticeOrders` = `0` and `latticeIncidentCases` = `0`.
- **RBAC & AI Core Intact:** All `8` `ldx_*` roles (`ldx_admin`, `ldx_director`, `ldx_manager`, `ldx_operator`, `ldx_warehouse`, `ldx_dispatcher`, `ldx_driver`, `ldx_employee`), `dxos-architect` in `latticeAiProfiles` and `aiEmployees`, and `FORCE ROW LEVEL SECURITY` on `latticeBuiltApps` are present.
- **Live App Builder Lifecycle Check:** Calls `/api/dxos-mcp` (`dxos_provision_role_workspace` -> `build_enterprise_app`) to provision parent/child `latticeCustom*` collections, verifies `dxosBlocks:collectionsMeta`, rebuilds `v2`, exports a `latticedx.solution-bundle/v3` bundle, and runs `dxosAi:teardownBuiltApp` (`keepData: false`).

::: warning Auto-Cleanup Behavior of `--blank-slate`
Without `--keep`, `--blank-slate` automatically executes `docker compose down -v --remove-orphans` in its `finally` block once verification finishes. Add `--keep` if you intend to log into the blank-slate UI afterward.
:::

### Mode B: Full Showcase & Multi-Portal Seed

After running `pnpm native:clean --port=13014` (without `--blank-slate`), you can seed the full multi-portal workspace, 7 Starter AI Profiles, 20 Unified AI Tools, and Cold-Chain / CMMS / Partner Settlement showcase records:

```sh
# Replace <path-to-report.json> with reportPath printed by pnpm native:clean
node scripts/setup-native-multi-portal-demo.mjs "<path-to-report.json>"
node scripts/setup-native-workspace-demo.mjs "<path-to-report.json>"
pnpm setup:dxos-ai -- --origin=http://localhost:13014
NOCOBASE_ADMIN_PASSWORD="<admin-password>" node scripts/seed-v030-demo-showcase.mjs --origin=http://localhost:13014
NOCOBASE_ADMIN_PASSWORD="<admin-password>" pnpm seed:v100-showcase -- --origin=http://localhost:13014
```

::: tip Default Local Lab Fixture Credentials
In local clean-install labs (never use in production):
- **Admin / Root:** `admin@nocobase.com` / `admin123` (or your `NOCOBASE_ADMIN_PASSWORD` override)
- **Demo Roles** (password `NativeLab-2026!`):
  - `native.lab.employee@example.invalid` (Negative RBAC & Employee self-service)
  - `native.lab.manager@example.invalid`
  - `native.lab.worker@example.invalid`
  - `native.lab.dispatcher@example.invalid`
  - `native.lab.driver@example.invalid`
:::

## 5. Landing URLs & Verification Endpoints

Once `http://localhost:13014` is up, explore the core DX-OS surfaces:

| Surface / Endpoint | URL Path | Description |
| :--- | :--- | :--- |
| **Plugin Manager** | `/admin/pm/list` | Verify all 7 `@latticedx/*` plugins enabled at `0.4.2` + NocoBase Clause 5.2 footer |
| **DX-OS AI Studio** | `/admin/settings/dxos-ai` | 9-tab AI Workforce Center (6-Plane Map, 20 Tools, MCP, App Builder ER, Quota, HITL, Trace Waterfall, Eval Lab) |
| **DX-OS Control Studio** | `/admin/settings/dxos-studio` | 11-tab Studio + 6 Governance Consoles (PaaS PAT, Ed25519 Ledger, MKT/Lineage, WMS FEFO, Visual DMN, Delegations) & GitOps Bundle v3 |
| **LatticeFlow v2 Studio** | `/admin/settings/workflow/automation` | Canvas-first DAG workflow studio (24 node types, HITL loop cursor, AI `dxos-architect` chat) |
| **P.A.R.A. Knowledge Vault** | `/admin/settings/dxos-para` | Document ingestion, `pgvector` HNSW + `tsvector` RRF hybrid search, OCR extraction |
| **Logistics & WMS Portal** | `/p/logistics` | 5-step Cold-Chain OMS/WMS, `DxosWmsOpsBlockModel`, Kanban/7-Day Schedule, QR SVG voucher |
| **Incidents & WebGIS Portal** | `/p/incidents` | MapLibre WebGIS Cold-Chain Digital Twin map, telemetry alarms, GraphRAG floating launcher |
| **Internal Services Portal** | `/p/services` | P.A.R.A. Knowledge Vault, OCR-to-Record autofill, all 12 Native v2 BlockModels |
| **CMMS & Partner Claims** | `/p/cmms`, `/p/partner-claims` | One-click Business Pack portals (`cmms-maintenance`, `coldchain-partner-settlement`) |
| **Mobile Field PWA** | `/v/mobile` | Offline-first IndexedDB outbox + ePOD camera capture + Digital Twin controls |
| **Public QR Verification** | `/v/track/<code-placeholder>` | Zero-PII Ed25519 tracking & document signature verification (`verifyTrackSignature`) |
| **Public Forms** | `/v/form/<slug>` | Rate-limited, honeypot-protected public submission portal |
| **Runtime Health & Specs** | `/api/dxos:health`, `/api/dxos:openapi` | Headless PaaS readiness probe and live OpenAPI 3.1 specification |

## 6. Stopping or Cleaning Up a Lab

Each `pnpm native:clean` run generates an exact `composeArgs` array in `report.json` referencing its isolated `overlay.yml`. To stop a running lab while preserving its volumes:

```sh
docker compose -p lattice-native-clean-<id> -f output/native-clean/<id>/source/infra/compose/native-rehearsal.yml -f output/native-clean/<id>/overlay.yml stop
```

To completely remove the lab containers and volumes:

```sh
docker compose -p lattice-native-clean-<id> -f output/native-clean/<id>/source/infra/compose/native-rehearsal.yml -f output/native-clean/<id>/overlay.yml down -v --remove-orphans
```

## Next Steps

- [Zero-Trust Production Deployment](/en/getting-started/production-deployment) — Harden and deploy with Caddy, APISIX, Keycloak, Valkey, PG16 `nocobase_app`, and 5 isolated networks.
- [Environment & Runtime Configuration](/en/getting-started/configuration) — Full reference of environment variables in `.env.example`, `infra/compose/prod.env.example`, and plugin runtimes.
