---
title: 7-Plugin Architecture & Host Contract
description: Inventory of the seven Apache-2.0 @latticedx/* plugins, 31 API resources, sdkProvidedByHost contract, nocobase-externals.mjs, and server lifecycle hooks on NocoBase 2.2.50.
---

# 7-Plugin Architecture & Host Contract

LatticeDX `v0.4.2` delivers all platform capabilities through **seven independent NocoBase plugins** under `plugins/nocobase/*`. This architecture keeps the Apache-2.0 source tree isolated from the NocoBase host runtime: `nocobase/nocobase:2.2.50` runs as an external OCI container and mounts the plugins under `sdkProvidedByHost: true`.

<PluginHostDiagram />

## Inventory of the 7 `@latticedx/*` Plugins (`0.4.2`)

Every package declares `"version": "0.4.2"`, `"private": true`, `"license": "Apache-2.0"`, `"supportedVersions": ["2.2.x"]`, `"testedRuntime": "2.2.50"`, and `"sdkProvidedByHost": true`, along with its own `LICENSE` and `README.md`.

| # | Directory (`plugins/nocobase/`) | Package Name (`package.json`) | Server & Client Entrypoints | Build Strategy & Host Externals |
| :---: | :--- | :--- | :--- | :--- |
| `1` | `action-bridge/` | `@latticedx/plugin-action-bridge` | `server.cjs`, `client.js`, `client-v2.js` | `build.mjs` copies `src/` to `dist/` and writes `dist/externalVersion.js` for `@nocobase/server`, `@nocobase/client`, `@nocobase/client-v2` |
| `2` | `plugin-lattice-foundation/` | `@latticedx/plugin-lattice-foundation` | `dist/server/index.js` (`LatticeFoundationPlugin`), `client.js`, `client-v2.js` | `scripts/build.mjs` syntax-checks JS via `node --check`, bundles relative client imports with a zero-dep loader, and externalizes NocoBase SDK packages, `react`, and `antd` |
| `3` | `plugin-enterprise-auth/` | `@latticedx/plugin-enterprise-auth` | `dist/server/index.js` (`EnterpriseLoginPlugin`), `client.js`, `client-v2.js` | Bundles `openid-client@6.8.9` via `bundleDependencies`; externalizes `@nocobase/server`, `@nocobase/auth`, `@nocobase/plugin-auth`, `@nocobase/client`, `@nocobase/client-v2`, `react`, and `antd` |
| `4` | `plugin-dxos-para/` | `@latticedx/plugin-dxos-para` | `dist/server/index.js` (`DxosParaPlugin`), `client.js`, `client-v2.js` | `build.mjs` copies `src/` to `dist/`; executes Office/PDF extraction and `pgvector` HNSW + `tsvector` RRF search via host `@nocobase/database` |
| `5` | `plugin-dxos-blocks/` | `@latticedx/plugin-dxos-blocks` | `dist/server/index.js` (`DxosBlocksServerPlugin`), `client.js`, `client-v2.js` | Uses `esbuild@0.28.2` to bundle `maplibre-gl@6.19.0` (including CSS and worker) into UMD client bundles; registers 12 Native v2 `BlockModel`s and `dxosBlocks` / `dxosBroker` |
| `6` | `plugin-dxos-studio/` | `@latticedx/plugin-dxos-studio` | `dist/server/index.js` (`DxosStudioPlugin`), `client.js`, `client-v2.js` | Uses `esbuild@0.28.2` to bundle `@xyflow/react@12.12.1` and `@dagrejs/dagre@3.1.3` into UMD client bundles for LatticeFlow v2, Visual DMN, WMS, Rich Schema, and `n8n` bridge |
| `7` | `plugin-dxos-ai/` | `@latticedx/plugin-dxos-ai` | `dist/server/index.js` (`DxosAiPlugin`), `client.js`, `client-v2.js` | `build.mjs` bundles relative client modules; registers 7 AI Profiles, 20 Unified Tools, Streamable HTTP MCP gateway, A2A gateway, and proactive triage scheduler |

### Resource Ownership & Gateway Routes per Plugin

All server APIs are registered via `this.app.resourceManager.define(...)` or `Gateway.registerRequestHandler(...)` along clean plugin boundaries:

| Owning Plugin | `resourceManager.define` Resources | Gateway Handlers & Guard Middleware |
| :--- | :--- | :--- |
| **`plugin-action-bridge`** | `dxActions` (`13` actions) | Server-side PKCE linking proxy for `/lattice/*` (fails closed with HTTP `503` when `DX_BRIDGE_*` env vars are unset) |
| **`plugin-lattice-foundation`** | `dxos`, `dxosApiKeys`, `dxosLedger`, `dxosDataGov`, `dxosVault`, `dxosEvents`, `dxosApprovals`, `dxosNotify`, `dxosForms`, `latticeNative`, `latticeApps`, `latticePortals`, `latticeChatter`, `latticeVoucher`, `latticeNotifications`, `latticeSla`, `latticeContextSync`, `latticeIntegrations` | `Gateway.registerRequestHandler`: `/v/form/*`, `/v/track/*`, `/v/lattice-brand.svg`, `/v/mobile` |
| **`plugin-enterprise-auth`** | `enterpriseAuth` (`9` actions) | `lattice-keycloak` authenticator + `enterpriseAuthRevocationGuard` middleware |
| **`plugin-dxos-para`** | `latticePara` (`6` actions) | P.A.R.A. organization scope middleware + `runAfterCommit` vector chunk retry handler |
| **`plugin-dxos-blocks`** | `dxosBlocks` (`17` actions), `dxosBroker` (`10` actions) | `dxosTelemetryDirectGuard` blocking raw CRUD on `latticeTelemetryPoints`, `latticeTwinShadows`, `latticeIotDevices` |
| **`plugin-dxos-studio`** | `dxosStudio`, `dxosWms`, `dxosDmn`, `dxosDelegations`, `dxosAutomations`, `dxosBuilder`, `dxosN8n` | Four guard middlewares (`dxosServiceScope`, `dxosWmsDmnScope`, `dxosAutomationScope`, `dxosOrganizationScope`) |
| **`plugin-dxos-ai`** | `dxosAi` (AI Assistant, App Builder 2.0, Eval Lab, `surfaceEvents`) | `POST /api/dxos-mcp`, `POST /api/dxos-mcp/it-ot`, `GET /.well-known/agent-card.json`, `POST /api/dxos-a2a` |

## Host Contract (`sdkProvidedByHost: true`) & `nocobase-externals.mjs`

Rather than vendoring `@nocobase/*` packages into the workspace `node_modules`, every plugin declares host SDK packages and shared frontend libraries as externals. At container startup, `nocobase/nocobase:2.2.50` resolves those imports directly from the host image runtime.

<ParamGrid
  title="Host Externals & Version Contract (scripts/lib/nocobase-externals.mjs)"
  :items="[
    { name: 'DEFAULT_NOCOBASE_VERSION', type: 'string', required: true, default: '2.2.50', description: 'Default NocoBase runtime version embedded in dist/externalVersion.js when NOCOBASE_VERSION is unset.' },
    { name: 'NOCOBASE_VERSION', type: 'env (SemVer)', required: false, default: '2.2.50', description: 'Optional environment override validated against SEMVER_RE before generating external metadata.' },
    { name: 'NOCOBASE_EXTERNAL_NAMES', type: 'string[7]', required: true, default: '2.2.50', description: '@nocobase/server, @nocobase/auth, @nocobase/plugin-auth, @nocobase/database, @nocobase/client, @nocobase/client-v2, @nocobase/plugin-workflow.' },
    { name: 'SHARED_VENDOR_VERSIONS', type: 'object', required: true, default: '18.2.0 / 5.24.2', description: 'Host-provided frontend vendor packages: react (18.2.0), react-dom (18.2.0), and antd (5.24.2).' }
  ]"
/>

`externalVersionSource(names, options)` in `scripts/lib/nocobase-externals.mjs` validates every requested package against the allowlist (`Object.hasOwn(versions, name)`), rejects any undeclared host dependency, and writes `dist/externalVersion.js` with an `SPDX-License-Identifier: Apache-2.0` header.

<CodeTabs
  :tabs="[
    {
      label: 'package.json (manifest)',
      lang: 'json',
      code: '{\n  \x22name\x22: \x22@latticedx/plugin-lattice-foundation\x22,\n  \x22version\x22: \x220.4.2\x22,\n  \x22private\x22: true,\n  \x22license\x22: \x22Apache-2.0\x22,\n  \x22main\x22: \x22dist/server/index.js\x22,\n  \x22nocobase\x22: {\n    \x22supportedVersions\x22: [\x222.2.x\x22],\n    \x22testedRuntime\x22: \x222.2.50\x22,\n    \x22sdkProvidedByHost\x22: true\n  }\n}'
    },
    {
      label: 'dist/externalVersion.js (output)',
      lang: 'javascript',
      code: '// SPDX-License-Identifier: Apache-2.0\nmodule.exports = {\n  \x22@nocobase/server\x22: \x222.2.50\x22,\n  \x22@nocobase/database\x22: \x222.2.50\x22,\n  \x22@nocobase/client\x22: \x222.2.50\x22,\n  \x22@nocobase/client-v2\x22: \x222.2.50\x22,\n  \x22@nocobase/plugin-workflow\x22: \x222.2.50\x22,\n  \x22react\x22: \x2218.2.0\x22,\n  \x22react-dom\x22: \x2218.2.0\x22,\n  \x22antd\x22: \x225.24.2\x22\n};'
    },
    {
      label: 'nocobase-externals.mjs',
      lang: 'javascript',
      code: 'export const DEFAULT_NOCOBASE_VERSION = \x222.2.50\x22;\nconst SEMVER_RE = /^\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?$/;\n\nexport function externalVersionSource(names, { version = resolveNocoBaseVersion() } = {}) {\n  if (!SEMVER_RE.test(String(version))) throw new Error(\x22Invalid NOCOBASE_VERSION\x22);\n  const declared = {};\n  for (const name of names) {\n    if (!Object.hasOwn(versions, name)) throw Error(\x22Unverified host dependency: \x22 + name);\n    declared[name] = versions[name];\n  }\n  return \x22// SPDX-License-Identifier: Apache-2.0\\nmodule.exports = \x22 + JSON.stringify(declared, null, 2) + \x22;\\n\x22;\n}'
    }
  ]"
/>

## Server Plugin Lifecycle Hooks & Middleware Ordering

Each server plugin extends `Plugin` from `@nocobase/server` and implements deterministic lifecycle hooks covering registration, idempotent seeding, startup repair, and clean teardown.

| Lifecycle Hook | Execution Phase | Standard Behavior Across `@latticedx/*` |
| :--- | :--- | :--- |
| **`load()`** | Plugin loading into Koa & ResourceManager | Registers collections, binds `this.db.attachLatticeRlsPolicy`, calls `resourceManager.define`, grants `acl.allow` / `acl.registerSnippet`, installs ordered middleware, registers `Gateway.registerRequestHandler`, attaches `db.on` hooks, and initializes schedulers (`_delayTicker`, `_triageScheduler`). |
| **`install()`** | Initial plugin installation | Runs idempotent database seeding under `withSystemRlsBypass` (`seedFoundation`, `ensureDefaultAiWorkforce`, `runStartupRepairs`). |
| **`afterEnable()`** | Re-enabling an existing plugin | Reconciles role action grants (`ensureIncidentManagerGrants`), starter AI profiles (`forceUpdate: false`), and route/SLA repairs without overwriting admin edits. |
| **`start()`** | Application boot completion | Runs idempotent startup grants and repairs (`ensureIncidentManagerGrants`, `runStartupRepairs`, alongside `this.app.once('afterStart', ...)`). |
| **`unload()` / `remove()` / `destroy()`** | Reload, disable, or shutdown | Stops `eventBusDrainer`, clears `stopAutomationListener()` timers, flushes `_otelExporter.shutdown()`, stops `_triageScheduler`, and calls `Gateway.unregisterRequestHandler` to prevent leaked listeners. |

### Middleware Execution Order & DB Event Hooks

Middleware registration uses explicit `before` and `after` anchors so authentication, direct-CRUD guards, and RLS transaction scoping execute in strict sequence:

| Anchor / Hook Stage | Registered Components & Enforcement |
| :--- | :--- |
| Before `auth` (`before: 'auth'`) | `latticePaasApiKeyAuth` parses `X-Lattice-API-Key` or `Authorization: Bearer` `ldx_pat_*` tokens and populates `ctx.state.currentUser` before session auth runs. |
| After `auth` (`after: 'auth'`) | `enterpriseAuthRevocationGuard` checks `revoked:` and `revoked_sid:` entries in Valkey DB `2`. |
| After `acl`, before `latticeNativeScope` (`after: 'acl', before: 'latticeNativeScope'`) | Domain guard middlewares (`dxosTelemetryDirectGuard`, `dxosServiceScope`, `dxosWmsDmnScope`, `dxosAutomationScope`, `dxosOrganizationScope`, `dxosAiProfileScope`, `dxosAiHitlScope`, `dxosAiMemoryAndA2aScope`) reject unauthorized direct collection queries before `latticeNativeScope` opens the RLS transaction. |
| After `dataWrapping`, before `dataSource` (`before: 'dataSource', after: 'dataWrapping'`) | `dxosMcpGateway`, `dxosA2aAgentCard`, and `dxosA2aGateway` intercept Streamable HTTP MCP JSON-RPC and A2A discovery requests. |
| DB lifecycle hooks (`this.db.on`) | `latticeServiceTickets.beforeValidate`, `WMS_DMN_COLLECTIONS` `.beforeValidate`, `latticeAiProfiles.beforeValidate` (preventing builder role escalation and SSRF in `mcpServers`), `roles.afterCreate` (stripping auto-granted roles from Builder AI profiles), and `llmServices.afterSave` (rebinding starter agents to updated LLM services). |

### Guard Middleware & DB Event Hook Reference

| Guard / Hook | Owning Plugin | Anchor & Enforcement Behavior |
| :--- | :--- | :--- |
| `latticePaasApiKeyAuth` | `plugin-lattice-foundation` | `before: 'auth'` — verifies `ldx_pat_*` via SHA-256 and clamps effective role below key bounds |
| `enterpriseAuthRevocationGuard` | `plugin-enterprise-auth` | `after: 'auth'` — rejects revoked subjects and session IDs tracked in Valkey DB `2` |
| `dxosTelemetryDirectGuard` | `plugin-dxos-blocks` | `after: 'acl', before: 'latticeNativeScope'` — blocks raw CRUD on telemetry, twin shadow, and IoT device tables |
| `dxosServiceScope` / `dxosWmsDmnScope` | `plugin-dxos-studio` | `after: 'acl', before: 'latticeNativeScope'` — enforces scoped service tickets and requires `dxosWms` / `dxosDmn` endpoints |
| `dxosAutomationScope` / `dxosOrganizationScope` | `plugin-dxos-studio` | `after: 'acl', before: 'latticeNativeScope'` — blocks raw automation CRUD and restricts `latticeOrganizations` direct access to `root` |
| `dxosAiProfileScope` / `dxosAiHitlScope` | `plugin-dxos-ai` | `after: 'acl', before: 'latticeNativeScope'` — restricts `latticeAiProfiles` to admins and blocks direct HITL queue writes |
| `dxosAiMemoryAndA2aScope` | `plugin-dxos-ai` | `after: 'acl', before: 'latticeNativeScope'` — requires dedicated endpoints for AI memory, A2A tasks, and OTel traces |
| `latticeAiProfiles.beforeValidate` & `roles.afterCreate` | `plugin-dxos-ai` | Locks `isAdminBuilder` roles, validates `mcpServers` URLs against SSRF, and strips auto-grants on new roles |
| `Gateway.registerRequestHandler` (`5` handlers) | `foundation` & `dxos-ai` | Serves `/v/form/*`, `/v/track/*`, `/v/lattice-brand.svg`, `/v/mobile`, and `/.well-known/agent-card.json`; unregistered cleanly on `unload()`/`destroy()` |

<CodeTabs
  :tabs="[
    {
      label: 'Plugin Lifecycle Skeleton (js)',
      lang: 'javascript',
      code: 'const { Plugin, Gateway } = require(\x22@nocobase/server\x22);\n\nclass CustomLatticePlugin extends Plugin {\n  async load() {\n    this.app.resourceManager.use(this.guardMiddleware(), {\n      tag: \x22customDomainGuard\x22,\n      after: \x22acl\x22,\n      before: \x22latticeNativeScope\x22,\n    });\n    this.app.resourceManager.define({ name: \x22customDomain\x22, actions: this.buildActions() });\n    this.app.once(\x22afterStart\x22, () => this.ensureSeeded().catch(() => {}));\n  }\n\n  async install() { await this.ensureSeeded(); }\n  async afterEnable() { await this.ensureSeeded(); }\n\n  async unload() {\n    this.stopTimers();\n    if (this._gatewayHandler) {\n      Gateway?.unregisterRequestHandler?.(this._gatewayHandler);\n      this._gatewayHandler = null;\n    }\n    if (typeof super.unload === \x22function\x22) await super.unload();\n  }\n}'
    },
    {
      label: 'Read-Only Compose Mounts (yaml)',
      lang: 'yaml',
      code: 'services:\n  nocobase:\n    image: nocobase/nocobase:2.2.50@sha256:04b75164936e7314ef74d82844bc56c9f34ed7ff1ca976ca53ffac2d3c88d777\n    volumes:\n      - ../../plugins/nocobase/action-bridge:/app/nocobase/node_modules/@latticedx/plugin-action-bridge:ro\n      - ../../plugins/nocobase/plugin-lattice-foundation:/app/nocobase/node_modules/@latticedx/plugin-lattice-foundation:ro\n      - ../../plugins/nocobase/plugin-enterprise-auth:/app/nocobase/node_modules/@latticedx/plugin-enterprise-auth:ro\n      - ../../plugins/nocobase/plugin-dxos-para:/app/nocobase/node_modules/@latticedx/plugin-dxos-para:ro\n      - ../../plugins/nocobase/plugin-dxos-blocks:/app/nocobase/node_modules/@latticedx/plugin-dxos-blocks:ro\n      - ../../plugins/nocobase/plugin-dxos-studio:/app/nocobase/node_modules/@latticedx/plugin-dxos-studio:ro\n      - ../../plugins/nocobase/plugin-dxos-ai:/app/nocobase/node_modules/@latticedx/plugin-dxos-ai:ro'
    },
    {
      label: 'Build & Test Plugin (bash)',
      lang: 'bash',
      code: '# Compile dist/ and emit dist/externalVersion.js for a plugin\ncd plugins/nocobase/plugin-lattice-foundation\nnode scripts/build.mjs\n\n# Run the plugin unit test suite with Node.js native test runner\nnode --test tests/*.test.cjs'
    }
  ]"
/>

## Operational Notes & Client Bundling Boundaries

| Operational Rule | Implementation Details |
| :--- | :--- |
| Immutable read-only mounts (`:ro`) | All seven plugin directories mount read-only inside `/app/nocobase/node_modules/@latticedx/*`. Build scripts generate `dist/externalVersion.js` and client bundles ahead of container launch. |
| Retired module cleanup | `plugin-lattice-foundation/scripts/build.mjs` explicitly unlinks retired files and legacy migrations after copying `src/` to `dist/`, preventing NocoBase auto-discovery from loading stale artifacts during local rebuilds. |
| Zero-proprietary client bundling | Plugins with only internal relative imports (`plugin-lattice-foundation`, `plugin-dxos-ai`) use a small built-in JS module bundler checked by `node --check`, while `plugin-dxos-blocks` and `plugin-dxos-studio` invoke `esbuild@0.28.2` (`MIT`) to bundle `maplibre-gl`, `@xyflow/react`, and `@dagrejs/dagre` into UMD client bundles with `react`, `react-dom`, `antd`, and `@nocobase/client*` kept external. |
| Clause 5.2 attribution preserved | `client` and `client-v2` navigation surfaces keep `Powered by NocoBase`, version `v2.2.50`, `https://www.nocobase.com`, and `License settings` intact. |

### Shared Static Exports Between Plugins

To let downstream plugins (`plugin-dxos-studio`, `plugin-dxos-ai`) call shared domain primitives without duplicating logic across packages, the core plugin classes attach static helpers directly on their exported `Plugin` constructors:

- **`LatticeFoundationPlugin`**: exposes `appendLedgerEntrySafely`, `computeMeanKineticTemperature`, `recordLineageEdge`, `captureQuarantineRecord`, `publishDomainEvent`, `verifyStandardWebhookSignature`, `resolveConnectorSecrets`, `recordGenAiSpan`, `startGenAiSpan`, `persistGenAiTrace`, `dispatchOmnichannel`, `requestApproval`, and `decideUnifiedInboxItem`.
- **`DxosStudioPlugin`**: exposes `parseFormulaAst`, `evaluateFormulaExpression`, `validateFormulaExpression`, `validateSafeRegexPattern`, `registerRichSchemaHooks`, `alignPortalOverviewRoutesSort`, `normalizeLegacySlaEscalateRoles`, and `createOrganizationDirectGuardMiddleware`.

## Related

- [6-Plane DX-OS Architecture Overview](/en/architecture/overview)
- [Multi-Tenancy & PostgreSQL 16 FORCE RLS](/en/architecture/multi-tenancy-rls)
- [Plugin SDK & Extension Reference](/en/reference/plugin-sdk)
- [Third-Party Boundaries & NocoBase Clause 5.2](/en/open-source/third-party-and-nocobase)
