---
title: Third-Party Boundaries & NocoBase 2.2.50
description: External OCI runtime isolation, sdkProvidedByHost contract, NocoBase 2.2.50 Clause 5.2 attribution, zero-.gitmodules policy, and upstream compatibility checks.
---

# Third-Party Boundaries & NocoBase 2.2.50

LatticeDX enforces a strict architectural separation between its `Apache-2.0` first-party source tree and external runtime dependencies. The `nocobase/nocobase:2.2.50` host runtime and all third-party infrastructure services execute inside isolated OCI containers, interacting with LatticeDX strictly over network protocols or runtime host SDK bindings.

## External OCI Runtime Boundary and Zero `.gitmodules`

The `CTU-OpenPaw/lattice-dx` Git repository and the `latticedx-0.4.2-src.tar.gz` source archive contain zero `upstream/nocobase/` directories, zero Git submodules, and zero `.gitmodules` manifests. First-party code neither copies, modifies, nor redistributes any upstream NocoBase source files.

### Upstream License Scope

Upstream NocoBase is governed by the **NocoBase License Agreement** (updated `2026-02-24`: `Apache-2.0` supplemented by Clauses `4.2` and `5.1–5.4`):

- **Clause 4.2** gives the supplementary clauses precedence whenever they conflict with standard `Apache-2.0` terms.
- **Clause 5.2** prohibits removing or obscuring NocoBase brand attribution in the running interface.
- **Clause 5.4** restricts offering public SaaS/PaaS services functioning as no-code, low-code, or AI platforms.
- Specific upstream core source files (such as `packages/core/server/src/application.ts`) carry `AGPL-3.0` and `NocoBase Commercial License` headers.

Because these supplementary restrictions fall outside standard OSI terms, the entire NocoBase host is isolated as an external OCI container image outside the Git repository:

```text
nocobase/nocobase:2.2.50@sha256:04b75164936e7314ef74d82844bc56c9f34ed7ff1ca976ca53ffac2d3c88d777
```

### Read-Only Runtime Plugin Mounts (`infra/compose/*.yml`)

The digest-pinned `nocobase/nocobase:2.2.50` image is referenced in `infra/compose/nocobase.yml`, `infra/compose/native-rehearsal.yml`, and `infra/compose/prod.yml`. At startup, all seven `Apache-2.0` plugins under `plugins/nocobase/` are mounted read-only (`:ro`) into `/app/nocobase/node_modules/@latticedx/*`:

```yaml
volumes:
  - nocobase-storage:/app/nocobase/storage
  - ../../plugins/nocobase/action-bridge:/app/nocobase/node_modules/@latticedx/plugin-action-bridge:ro
  - ../../plugins/nocobase/plugin-lattice-foundation:/app/nocobase/node_modules/@latticedx/plugin-lattice-foundation:ro
  - ../../plugins/nocobase/plugin-enterprise-auth:/app/nocobase/node_modules/@latticedx/plugin-enterprise-auth:ro
  - ../../plugins/nocobase/plugin-dxos-para:/app/nocobase/node_modules/@latticedx/plugin-dxos-para:ro
  - ../../plugins/nocobase/plugin-dxos-blocks:/app/nocobase/node_modules/@latticedx/plugin-dxos-blocks:ro
  - ../../plugins/nocobase/plugin-dxos-studio:/app/nocobase/node_modules/@latticedx/plugin-dxos-studio:ro
  - ../../plugins/nocobase/plugin-dxos-ai:/app/nocobase/node_modules/@latticedx/plugin-dxos-ai:ro
```

## Host SDK Contract (`sdkProvidedByHost: true`)

All seven LatticeDX plugins bind to host APIs at runtime rather than bundling host SDK packages. Every plugin `package.json` declares the identical `nocobase` contract metadata:

<CodeTabs :tabs="[
  { label: 'Plugin package.json', lang: 'json', code: JSON.stringify({ name: '@latticedx/plugin-lattice-foundation', version: '0.4.2', license: 'Apache-2.0', nocobase: { supportedVersions: ['2.2.x'], testedRuntime: '2.2.50', sdkProvidedByHost: true } }, null, 2) },
  { label: 'nocobase-externals.mjs', lang: 'js', code: 'export const DEFAULT_NOCOBASE_VERSION = \'2.2.50\';\nconst SHARED_VENDOR_VERSIONS = {\n  react: \'18.2.0\',\n  \'react-dom\': \'18.2.0\',\n  antd: \'5.24.2\',\n};\nconst NOCOBASE_EXTERNAL_NAMES = [\n  \'@nocobase/server\',\n  \'@nocobase/auth\',\n  \'@nocobase/plugin-auth\',\n  \'@nocobase/database\',\n  \'@nocobase/client\',\n  \'@nocobase/client-v2\',\n  \'@nocobase/plugin-workflow\',\n];' },
  { label: 'dist/externalVersion.js', lang: 'js', code: '// SPDX-License-Identifier: Apache-2.0\nmodule.exports = ' + JSON.stringify({ '@nocobase/server': '2.2.50', '@nocobase/database': '2.2.50', '@nocobase/client': '2.2.50', '@nocobase/client-v2': '2.2.50', react: '18.2.0', antd: '5.24.2' }, null, 2) + ';' }
]" />

The build helper at `scripts/lib/nocobase-externals.mjs` exports `externalVersionSource(names, { version })` to emit `dist/externalVersion.js` during plugin builds, guaranteeing that host packages are excluded from plugin bundles:

<ParamGrid title="Host-External Modules Provided at Runtime by NocoBase 2.2.50" :items="[
  { name: '@nocobase/server', type: '2.2.50', required: true, description: 'Server application lifecycle, HTTP middleware, gateway, and resourceManager.' },
  { name: '@nocobase/database', type: '2.2.50', required: true, description: 'Sequelize ORM adapter, collection registry, migration runner, and repository hooks.' },
  { name: '@nocobase/auth', type: '2.2.50', required: true, description: 'Token signer, base authenticator class, and request user context.' },
  { name: '@nocobase/plugin-auth', type: '2.2.50', required: true, description: 'Authenticator registry consumed by @latticedx/plugin-enterprise-auth.' },
  { name: '@nocobase/client', type: '2.2.50', required: true, description: 'Client v1 plugin base, UI schema components, and pluginSettingsManager.' },
  { name: '@nocobase/client-v2', type: '2.2.50', required: true, description: 'FlowEngine v2 client supporting all 12 Native BlockModels, ShellModel, and /v/mobile.' },
  { name: '@nocobase/plugin-workflow', type: '2.2.50', required: true, description: 'Host workflow integration surface for @latticedx/plugin-lattice-foundation.' },
  { name: 'react / react-dom / antd', type: '18.2.0 / 5.24.2', required: true, description: 'Shared UI vendor globals supplied by the host to preserve a single React context.' }
]" />

`externalVersionSource` validates every requested package against the allowlist and throws `Unverified host dependency` if any plugin references an unapproved host external.

### `esbuild` Bundling and Host External Exclusion

When compiling client UMD bundles (`dist/client/index.js`), `@latticedx/plugin-dxos-studio` and `@latticedx/plugin-dxos-blocks` invoke `esbuild@0.28.2` to bundle graph (`@xyflow/react`, `@dagrejs/dagre`) and WebGIS (`maplibre-gl`) libraries while keeping shared runtime dependencies external:

```js
const HOST_EXTERNALS = [
  'react',
  'react-dom',
  'antd',
  '@nocobase/client',
  '@nocobase/client-v2',
  '@nocobase/server',
  '@nocobase/database',
];
```

This configuration ensures plugin bundles resolve `React`, `antd`, and `@nocobase/client` directly from the NocoBase `2.2.50` host runtime context, avoiding duplicate React instances and keeping host code out of build artifacts.

## NocoBase `2.2.50` Clause 5.2 Attribution

LatticeDX preserves all attribution elements required under Clause 5.2 of the NocoBase License Agreement (`Powered by NocoBase`, runtime version `v2.2.50`, link target `https://www.nocobase.com`, and host `License settings` navigation) across the application UI and technical documentation:

| Source File / Location | Rendered Surface | Preservation Rule |
| :--- | :--- | :--- |
| `plugin-lattice-foundation/src/client/native-builder-navigation.js` | `.ldx-clause52-attribution` portal footer | Keep `Powered by NocoBase` and link to `https://www.nocobase.com` intact |
| `plugin-lattice-foundation/src/client/native-portal-settings.js` | Multi-Portal settings console footer | Keep `LatticeDX Open-Core (Apache-2.0) · Powered by NocoBase` visible |
| `plugin-dxos-ai/src/client/index.js` | Exported constant `CLAUSE_52_ATTRIBUTION` | Preserve attribution string in AI Studio client bundle |
| `.vitepress/config.ts` | Global VitePress documentation footer | Keep `Powered by NocoBase 2.2.50` link on both VI and EN locales |

Custom themes and portal layouts must never hide (`display: none`), strip, or alter the `Powered by NocoBase` text or `https://www.nocobase.com` link. Automated repository checks scan `plugins/nocobase/plugin-lattice-foundation/src/client/` for `Powered by NocoBase` or `nocobase.com` and fail verification if the attribution marker is removed.

## External Containerized Infrastructure Inventory (Network Boundary)

All third-party infrastructure services listed below execute in separate OCI containers defined under `infra/compose/*.yml` and communicate strictly over standard network protocols (`SQL`, `HTTP/REST`, `OIDC`, `NGSI-LD`, `MQTT`, `clamd TCP`, `OTLP`). None are copied into first-party packages, statically linked, or relicensed as `Apache-2.0`.

| Container Image | Version & Digest (`@sha256:`) | License | Network Boundary & Compose Files |
| :--- | :--- | :--- | :--- |
| `nocobase/nocobase` | `2.2.50` (`04b75164936e...8d777`) | `NocoBase License Agreement` | External host OCI runtime (`nocobase.yml`, `native-rehearsal.yml`, `prod.yml`) |
| `postgres` | `16.16-alpine` (`f2f98726820d...afb6d`) | `PostgreSQL` | TCP SQL (`core.yml`, `prod.yml`) |
| `pgvector/pgvector` | `0.8.1-pg16` (`33198da2828a...20337`) | `PostgreSQL` | TCP SQL + HNSW vector (`nocobase.yml`, `native-rehearsal.yml`, `prod.yml`) |
| `valkey/valkey` | `8.1-alpine` (`9971099af41c...fc3fc`) | `BSD-3-Clause` | RESP TCP cache/PubSub (`nocobase.yml`, `prod.yml`) |
| `rustfs/rustfs` | `1.0.6` (`ee717072290b...5044a`) | `Apache-2.0` | HTTP S3 API (`prod.yml`) |
| `caddy` | `2.10-alpine` (`4c6e91c6ed0e...18e530d`) | `Apache-2.0` | HTTPS/TLS ingress (`prod.yml`) |
| `quay.io/keycloak/keycloak` | `26.8.2` (`7e66a96e4739...ba38b3`) | `Apache-2.0` | OIDC / HTTPS (`core.yml`, `prod.yml`) |
| `adorsys/keycloak-config-cli` | `6.5.1-26` (`1b22dfaa9ae0...b1411`) | `Apache-2.0` | HTTP Admin API oneshot (`prod.yml`) |
| `apache/apisix` | `3.19.0-debian` (`9a7e45dc943f...61141`) | `Apache-2.0` | HTTP API gateway (`core.yml`, `prod.yml`) |
| `otel/opentelemetry-collector-contrib` | `0.123.0` (`e39311df1f3d...aee4d2`) | `Apache-2.0` | OTLP HTTP/gRPC (`prod.yml`) |
| `prom/prometheus` | `v3.3.0` (`339ce86a5941...fb2f1`) | `Apache-2.0` | HTTP `/api/dxos:metrics` (`prod.yml`) |
| `nodered/node-red` | `4.0.9` (`0b295b3a14c5...db4b5`) | `Apache-2.0` | HTTP webhook + MQTT (`iiot.yml`, `prod.yml`) |
| `eclipse-mosquitto` | `2.0.21` (`94f5a3d7deaf...4d353`) | `EPL-2.0 OR BSD-3-Clause` | MQTT TCP on `iiot-net` (`iiot.yml`, `prod.yml`) |
| `gotenberg/gotenberg` | `8.20.1` (`cda4386c7ed3...29bac`) | `MIT` | Optional HTTP PDF renderer (`prod.yml`, profile `pdf`) |
| `clamav/clamav` | `1.5.5` (`12177441d1b4...a6dd8`) | `GPL-2.0-only` | `clamd` TCP via `apps/file-scanner` (`core.yml`, `prod.yml`) |
| `fiware/orion-ld` | `1.12.0` (`f562a93ed84c...bd613b`) | `AGPL-3.0-only` | HTTP NGSI-LD (`integration.yml`, `prod.yml`) |
| `grafana/grafana-oss` | `11.5.8` (`b8121de93047...6a48`) | `AGPL-3.0-only` | Standalone HTTP dashboard (`prod.yml`, profile `observability`) |
| `mongo` | `8.0` (`479e85ced54f...575d01`) | `SSPL-1.0` | Private wire protocol for `orion-ld` (`integration.yml`, `prod.yml`) |
| `n8nio/n8n` | `2.48.1` (`5e022f23ef9e...009f`) | `Sustainable Use License` | Optional external REST v1 + OAuth2 PKCE bridge (`integration.yml`, `prod.yml`, profile `n8n`) |

### Opt-In Profile and Network Isolation

| Service Group | License | Compose Profile / Network | Integration Surface |
| :--- | :--- | :--- | :--- |
| `n8nio/n8n:2.48.1` | `Sustainable Use License` | `n8n` profile (`app`, `data`) | External REST API v1 + OAuth2 PKCE bridge via `dxosN8n` |
| `grafana/grafana-oss:11.5.8` | `AGPL-3.0-only` | `observability` profile (`app`, `data`) | Queries internal Prometheus over HTTP |
| `fiware/orion-ld:1.12.0` & `mongo:8.0` | `AGPL-3.0-only` / `SSPL-1.0` | Default (`app`, `data`) | NGSI-LD HTTP updates drained from `latticeContextOutbox` |
| `clamav/clamav:1.5.5` | `GPL-2.0-only` | Internal `scanner` network | TCP port `3310` accessed solely by `apps/file-scanner` |

## Upstream Compatibility Verification

Before adopting a new `2.2.x` patch release of NocoBase, verify compatibility against an isolated host instance:

| Step | Verification Stage | Execution & Acceptance Check |
| :---: | :--- | :--- |
| `1` | Override external version metadata | Set `NOCOBASE_VERSION=<semver>` (validated by `resolveNocoBaseVersion()` against strict `MAJOR.MINOR.PATCH` semver format; defaults to `'2.2.50'`). |
| `2` | Validate externals contract | Run `node --test tests/nocobase-externals.test.mjs` to check declared host bindings and `dist/externalVersion.js` generation. |
| `3` | Run isolated rehearsal stack | Launch `infra/compose/native-rehearsal.yml` (Compose project `lattice-native-rehearsal`, bound to `127.0.0.1:13001`) to test fresh database bootstrap, plugin migrations, and Clause 5.2 attribution before updating the pinned `@sha256:` digest in `prod.yml`. |

```sh
NOCOBASE_VERSION=2.2.50 node --test tests/nocobase-externals.test.mjs
docker compose -f infra/compose/native-rehearsal.yml config --quiet
```

## Related

- [Licensing & Pure-OSI Policy](/en/open-source/licensing)
- [CycloneDX SBOM & Build from Source](/en/open-source/sbom-and-source-build)
- [7-Plugin Modular System](/en/architecture/plugin-system)
- [Upgrading Guide](/en/getting-started/upgrading)
