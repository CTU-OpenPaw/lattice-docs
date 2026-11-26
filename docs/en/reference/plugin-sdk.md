---
title: Plugin SDK & Host Contract
description: Apache-2.0 plugin anatomy, server/client/client-v2 entrypoints, sdkProvidedByHost contract, nocobase-externals.mjs, and node --test patterns.
---

<script setup>
const sdkTabs = [
  {
    label: 'build.mjs (Host Externals)',
    lang: 'js',
    code: `import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { externalVersionSource } from '../../../scripts/lib/nocobase-externals.mjs';

const root = new URL('./', import.meta.url);
await rm(new URL('dist/', root), { recursive: true, force: true });
await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(
  new URL('dist/externalVersion.js', root),
  externalVersionSource([
    '@nocobase/server',
    '@nocobase/database',
    '@nocobase/client',
    '@nocobase/client-v2',
    'react',
    'react-dom',
    'antd',
  ]),
  'utf8',
);
await cp(new URL('src/', root), new URL('dist/', root), { recursive: true });`,
  },
  {
    label: 'Server Plugin',
    lang: 'js',
    code: `'use strict';
const { Plugin } = require('@nocobase/server');
const { withTenantRlsContext } = require('./pg-rls');

class CustomDomainPlugin extends Plugin {
  async load() {
    this.app.resourceManager.define({
      name: 'dxosExample',
      actions: {
        ping: async (ctx, next) => {
          if (ctx.method !== 'GET') ctx.throw(405);
          const orgId = ctx.state?.latticeRlsOrg || 'default';
          ctx.body = await withTenantRlsContext(this.db, orgId, async () => ({
            ok: true,
            organizationId: orgId,
          }));
          await next();
        },
      },
    });
    this.app.acl.allow('dxosExample', ['ping'], 'loggedIn');
  }
}

module.exports = CustomDomainPlugin;
module.exports.default = CustomDomainPlugin;`,
  },
  {
    label: 'Unit Test (node --test)',
    lang: 'js',
    code: `'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

function withMockedNocobase(fn) {
  const origLoad = Module._load;
  class MockPlugin {
    constructor(app, options = {}) {
      this.app = app;
      this.db = app?.db;
      this.options = options;
    }
  }
  Module._load = function (request, parent, isMain) {
    if (request === '@nocobase/server') return { Plugin: MockPlugin };
    if (request === '@nocobase/database') return { defineCollection: (def) => def };
    return origLoad.call(this, request, parent, isMain);
  };
  return Promise.resolve().then(fn).finally(() => {
    Module._load = origLoad;
  });
}

test('registers resource action cleanly', () =>
  withMockedNocobase(async () => {
    const defined = [];
    const mockApp = {
      db: {},
      resourceManager: { define: (def) => defined.push(def) },
      acl: { allow: () => {} },
    };
    const PluginCls = require('../dist/server/index.js');
    await new PluginCls(mockApp).load();
    assert.ok(defined.length >= 1);
  }),
);`,
  },
];
</script>

# Plugin SDK & Host Contract

LatticeDX packages its domain capabilities into 7 Apache-2.0 plugins under `plugins/nocobase/`, mounted read-only into `/app/nocobase/node_modules/@latticedx/*` inside the external `nocobase/nocobase:2.2.50` host container. Declaring `sdkProvidedByHost: true` keeps the Pure-OSI plugin source tree decoupled from the upstream host dependency graph during builds and source releases.

## Plugin Anatomy and Manifest

Each plugin directory contains `package.json`, an individual Apache-2.0 `LICENSE`, `README.md`, three root entrypoints (`server.js` or `server.cjs`, `client.js`, `client-v2.js`), `src/`, and compiled `dist/` output.

```text
plugins/nocobase/plugin-example/
├── package.json
├── LICENSE
├── README.md
├── server.js          # module.exports = require('./dist/server/index.js')
├── client.js          # module.exports = require('./dist/client/index.js')
├── client-v2.js       # module.exports = require('./dist/client-v2/index.js')
├── scripts/build.mjs  # or build.mjs at plugin root
├── src/
│   ├── server/
│   │   ├── index.js
│   │   ├── collections/*.js
│   │   └── migrations/*.js
│   ├── client/index.js
│   └── client-v2/index.js
└── tests/*.test.cjs
```

<ParamGrid
  title="Required Plugin package.json Fields"
  :items="[
    { name: 'name', type: 'string', required: true, description: 'Package name under @latticedx/* matching the container mount directory.' },
    { name: 'version', type: 'string', required: true, default: '0.4.2', description: 'Platform release version (locked to 0.4.2 across all 7 plugins).' },
    { name: 'license', type: 'string', required: true, default: 'Apache-2.0', description: 'Pure-OSI license identifier paired with a dedicated LICENSE file.' },
    { name: 'main', type: 'string', required: true, default: 'dist/server/index.js', description: 'CommonJS entrypoint exporting the server Plugin subclass.' },
    { name: 'files', type: 'string[]', required: true, description: 'Distribution whitelist: dist, server.js, client.js, client-v2.js, README.md, LICENSE.' },
    { name: 'nocobase.supportedVersions', type: 'string[]', required: true, default: '[2.2.x]', description: 'Compatible NocoBase host runtime major/minor line.' },
    { name: 'nocobase.testedRuntime', type: 'string', required: true, default: '2.2.50', description: 'Exact verified NocoBase OCI runtime version.' },
    { name: 'nocobase.sdkProvidedByHost', type: 'boolean', required: true, default: 'true', description: 'Declares that @nocobase/*, react, react-dom, and antd are supplied by the host at runtime.' }
  ]"
/>

### Official 7-Plugin Inventory (`0.4.2`)

| Directory | Package Name (`package.json`) | Server Entrypoint | Client Packaging Strategy |
|---|---|---|---|
| `action-bridge/` | `@latticedx/plugin-action-bridge` | `server.cjs` | `build.mjs` copies `src/` to `dist/` and emits `dist/externalVersion.js` |
| `plugin-lattice-foundation/` | `@latticedx/plugin-lattice-foundation` | `server.js` (`LatticeFoundationPlugin`) | `scripts/build.mjs` bundles relative imports for `client` and `client-v2` |
| `plugin-enterprise-auth/` | `@latticedx/plugin-enterprise-auth` | `server.js` (`EnterpriseLoginPlugin`) | Bundles `openid-client@6.8.9` via `bundleDependencies` |
| `plugin-dxos-para/` | `@latticedx/plugin-dxos-para` | `server.js` (`DxosParaPlugin`) | Copies `src/` to `dist/` while keeping all host SDK packages external |
| `plugin-dxos-blocks/` | `@latticedx/plugin-dxos-blocks` | `server.js` (`DxosBlocksServerPlugin`) | `esbuild@0.28.2` bundles MIT `maplibre-gl@6.19.0` (CSS + worker) into UMD client |
| `plugin-dxos-studio/` | `@latticedx/plugin-dxos-studio` | `server.js` (`DxosStudioPlugin`) | `esbuild@0.28.2` bundles MIT `@xyflow/react@12.12.1` + `@dagrejs/dagre@3.1.3` into UMD |
| `plugin-dxos-ai/` | `@latticedx/plugin-dxos-ai` | `server.js` (`DxosAiPlugin`) | Bundles relative client modules with host SDK kept external |

## Host Bindings and `nocobase-externals.mjs`

The shared helper `scripts/lib/nocobase-externals.mjs` establishes the deterministic version contract between plugins and the `nocobase/nocobase:2.2.50` host image. During build, `externalVersionSource(names)` emits `dist/externalVersion.js` without installing `@nocobase/*` packages into the source repository's `node_modules`.

| Constant / Export | Default Value | Purpose |
|---|---|---|
| `DEFAULT_NOCOBASE_VERSION` | `2.2.50` | Overridable via `NOCOBASE_VERSION` (validated against strict semver) |
| `NOCOBASE_EXTERNAL_NAMES` | `@nocobase/server`, `@nocobase/auth`, `@nocobase/plugin-auth`, `@nocobase/database`, `@nocobase/client`, `@nocobase/client-v2`, `@nocobase/plugin-workflow` | Core host SDK modules resolved from the runtime container |
| `SHARED_VENDOR_VERSIONS` | `react: 18.2.0`, `react-dom: 18.2.0`, `antd: 5.24.2` | Shared frontend vendor versions aligned across host and plugins |

The `plugin-isolation` verification gate rejects any plugin bundle containing duplicate copies of `@nocobase/*`, `react`, `react-dom`, or `antd`, and preserves `Powered by NocoBase` (`v2.2.50`, `https://www.nocobase.com`) attribution per Clause 5.2.

### Container Mount Isolation

In `infra/compose/nocobase.yml` and `infra/compose/prod.yml`, all 7 plugin directories mount read-only (`:ro`) into `/app/nocobase/node_modules/@latticedx/*`. Because `dist/` is prebuilt by `node scripts/build.mjs` (or `node build.mjs`), the production NocoBase container runs without build toolchains and introduces zero non-OSI source dependencies.

## Server, Client, and Client-v2 Lifecycles

### Server Plugin (`@nocobase/server`)

Subclasses of `Plugin` from `@nocobase/server` implement NocoBase lifecycle hooks in execution order:

| Lifecycle Hook | Phase & Execution Behavior |
| :--- | :--- |
| `load()` | Registers collection schemas (`src/server/collections/*`), defines resources via `this.app.resourceManager.define()`, declares permissions via `this.app.acl.allow()` / `registerSnippet()`, attaches ordered middleware (`this.app.resourceManager.use(..., { tag, before, after })`), and registers public gateway routes via `Gateway.registerRequestHandler()`. |
| `install()` | Executes idempotent seed logic wrapped in `withSystemRlsBypass(this.db, ...)` when `DX_PG_RLS_SESSION=true`. |
| `afterEnable()` / `start()` | Synchronizes default role grants once application boot completes. |
| `unload()` / `remove()` / `destroy()` | Unregisters all `Gateway` request handlers, stops background outbox drainers, and calls `shutdown()` on `otelExporter` for clean teardown. |

### Client (`@nocobase/client`) and Client-v2 (`@nocobase/client-v2`) Entrypoints

The NocoBase frontend loads plugin bundles through UMD factories supporting both AMD (`define('@latticedx/<pkg>', [...], factory)`) and CommonJS:

- **`client.js` (`@nocobase/client`)**: Extends `client.Plugin` for administrative screens, `useAPIClient()` hooks, and portal settings. Plugins shipping client libraries such as `maplibre-gl` (`plugin-dxos-blocks`) or `@xyflow/react` and `@dagrejs/dagre` (`plugin-dxos-studio`) run `esbuild` with custom external-resolution plugins to bundle Pure-OSI dependencies into `dist/client/index.js` while leaving `@nocobase/*`, `react`, `react-dom`, and `antd` external.
- **`client-v2.js` (`@nocobase/client-v2`)**: Registers FlowEngine BlockModels (including the 12 native v2 BlockModels in `plugin-dxos-blocks`) and unauthenticated public routes (`skipAuthCheck: true` for `/mobile`, `/track/:code`, `/form/:slug`) via `this.app.router.add()`.

## Building and Testing Plugins (`node --test`)

Unit tests under `plugins/nocobase/*/tests/*.test.cjs` execute directly via `node --test` on Node.js 24 LTS. Tests mock `@nocobase/server` and `@nocobase/database` through `Module._load`, enabling deterministic verification of resource actions, RLS guards, and schema hooks without booting an external container. Companion `scripts/check-runtime.cjs` scripts run inside the live container after startup to verify migration idempotency and relational integrity.

<CodeTabs :tabs="sdkTabs" />

## Related

- [Plugin System Architecture](/en/architecture/plugin-system)
- [REST API Reference](/en/reference/rest-api)
- [Third-Party & NocoBase Attribution](/en/open-source/third-party-and-nocobase)
- [Testing & Verification](/en/operations/testing-and-verification)
