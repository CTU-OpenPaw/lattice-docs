---
title: Licensing & Pure-OSI Policy
description: Apache-2.0 licensing scope for LatticeDX v0.4.2 first-party code, Pure-OSI dependency enforcement, and automated SPDX header compliance.
---

# Licensing & Pure-OSI Policy

All original source code authored by CTU-OpenPaw for **LatticeDX `v0.4.2`** is distributed under the **Apache License, Version 2.0** (`Apache-2.0`). Project governance maintains a strict boundary between the Pure-OSI first-party codebase and external runtime containers or third-party infrastructure services.

## First-Party Apache-2.0 Scope

The root `LICENSE` file governs all original source code, deployment definitions, contract schemas, and test suites maintained in the repository across these directories:

| Repository Path | Role | License |
| :--- | :--- | :--- |
| `apps/` | Standalone backend services (`@dx/api`, `@dx/agent-worker`, `@dx/file-scanner`) | `Apache-2.0` |
| `packages/` | Shared type contracts (`@dx/contracts`) and reference package (`@latticedx/uc1-procurement`) | `Apache-2.0` |
| `plugins/nocobase/` | Seven modular extension plugins for NocoBase host runtime (`0.4.2`) | `Apache-2.0` |
| `solutions/` | Domain solution configurations and models (`solutions/logistics`) | `Apache-2.0` |
| `infra/` | Docker Compose stacks (`infra/compose/*.yml`) and edge/database configuration | `Apache-2.0` |
| `scripts/` | Plugin build scripts, SBOM generator, SPDX header checker, backup, and tarball tooling | `Apache-2.0` |
| `tests/` | Unit test suites and host externals verification | `Apache-2.0` |
| `.github/` | CI workflows (`ci.yml`), static `CodeQL` analysis (`codeql.yml`), and issue/PR templates | `Apache-2.0` |

Alongside the root `LICENSE`, two repository-level files track attribution and ownership boundaries:

- `NOTICE` defines five explicit sections: first-party `Apache-2.0` code, the Pure-OSI Git boundary with the external NocoBase `2.2.50` OCI host, third-party containerized infrastructure over network boundaries, bundled dependencies inside `@latticedx/plugin-enterprise-auth`, and `pnpm-lock.yaml` workspace packages.
- `COPYRIGHT.txt` summarizes copyright ownership across workspace applications, shared libraries, the seven NocoBase plugins, and direct third-party components.

Each plugin directory under `plugins/nocobase/*/` includes its own `LICENSE` and `README.md` file and declares `"license": "Apache-2.0"` and `"version": "0.4.2"` in `package.json`.

### First-Party Workspace Packages (`0.4.2`)

| Package Name (`package.json`) | Category | Path | License |
| :--- | :--- | :--- | :--- |
| `lattice-dx` | Workspace root | `package.json` | `Apache-2.0` |
| `@dx/contracts` | Shared library | `packages/contracts` | `Apache-2.0` |
| `@dx/api` | Fastify API service | `apps/api` | `Apache-2.0` |
| `@dx/agent-worker` | Incident advisory worker | `apps/agent-worker` | `Apache-2.0` |
| `@dx/file-scanner` | ClamAV + S3 scanner sidecar | `apps/file-scanner` | `Apache-2.0` |
| `@latticedx/uc1-procurement` | Reference manifests | `packages/uc1-procurement` | `Apache-2.0` |
| `@latticedx/plugin-action-bridge` | NocoBase plugin | `plugins/nocobase/action-bridge` | `Apache-2.0` |
| `@latticedx/plugin-lattice-foundation` | NocoBase plugin | `plugins/nocobase/plugin-lattice-foundation` | `Apache-2.0` |
| `@latticedx/plugin-enterprise-auth` | NocoBase plugin | `plugins/nocobase/plugin-enterprise-auth` | `Apache-2.0` |
| `@latticedx/plugin-dxos-para` | NocoBase plugin | `plugins/nocobase/plugin-dxos-para` | `Apache-2.0` |
| `@latticedx/plugin-dxos-blocks` | NocoBase plugin | `plugins/nocobase/plugin-dxos-blocks` | `Apache-2.0` |
| `@latticedx/plugin-dxos-studio` | NocoBase plugin | `plugins/nocobase/plugin-dxos-studio` | `Apache-2.0` |
| `@latticedx/plugin-dxos-ai` | NocoBase plugin | `plugins/nocobase/plugin-dxos-ai` | `Apache-2.0` |

## Pure-OSI Dependency Policy

Every package installed through `pnpm-lock.yaml`, bundled into a plugin distribution, or tracked in Git must carry a license approved by the [Open Source Initiative (OSI)](https://opensource.org/licenses). The root `Apache-2.0` license applies strictly to CTU-OpenPaw source code and does not supersede upstream dependency licenses; original copyright notices are preserved in distributed build artifacts.

Running `pnpm licenses list --json` against the locked workspace records `153` grouped package entries across these OSI-approved license expressions:

| SPDX License Expression | Package Entries | Representative Workspace Packages |
| :--- | :---: | :--- |
| `MIT` | `115` | `fastify`, `jose`, `pg`, `vitest`, `tsx`, `esbuild`, `@xyflow/react`, `@dagrejs/dagre` |
| `ISC` | `21` | `semver`, `picocolors`, `earcut`, `d3-selection`, `@maplibre/maplibre-gl-style-spec` |
| `BSD-3-Clause` | `8` | `maplibre-gl`, `fast-uri`, `light-my-request`, `secure-json-parse`, `source-map-js` |
| `Apache-2.0` | `4` | `typescript`, `@typescript/typescript-*`, `detect-libc`, `expect-type` |
| `BSD-2-Clause` | `2` | `@mapbox/tiny-sdf`, `@mapbox/unitbezier` |
| `MPL-2.0` | `2` | `lightningcss`, `lightningcss-*` |
| `(MIT OR Apache-2.0)` | `1` | `@maplibre/mlt` |

### BSL-1.1 Exclusion and OSI Infrastructure Stack

The SBOM generator (`scripts/generate-sbom.mjs`) enforces two hard filters (`BANNED_LICENSE_RE` and `BANNED_TECH_RE`) that fail builds whenever any package or container image carries **BSL-1.1 / Business Source License** terms or restricted platforms such as `thingsboard` or `emqx`.

Core infrastructure services are selected from OSI-approved projects:

| Infrastructure Service | License (SPDX) | Architectural Role |
| :--- | :--- | :--- |
| `valkey/valkey:8.1-alpine` | `BSD-3-Clause` | Session cache, SSE PubSub (`PUBSUB_ADAPTER=redis`), and APISIX rate-limit store |
| `eclipse-mosquitto:2.0.21` | `EPL-2.0 OR BSD-3-Clause` | IIoT MQTT broker with Dynamic Security (`allow_anonymous false`) and LWT events |
| `nodered/node-red:4.0.9` | `Apache-2.0` | Sensor payload normalization and Digital Twin downlink orchestration |
| `pgvector/pgvector:0.8.1-pg16` | `PostgreSQL` | Vector embeddings for P.A.R.A. and IIoT time-series storage in `latticeTelemetryPoints` |
| `rustfs/rustfs:1.0.6` | `Apache-2.0` | S3-compatible object storage for file uploads and ePOD attachments |
| `caddy:2.10-alpine` & `apache/apisix:3.19.0` | `Apache-2.0` | TLS reverse proxy and Zero-Trust API gateway |
| `quay.io/keycloak/keycloak:26.8.2` | `Apache-2.0` | Centralized OIDC / PKCE S256 identity provider |

## Plugin Bundling & External Host Boundary

All seven NocoBase plugins declare `"sdkProvidedByHost": true` so they never embed host source code or shared host UI packages (`react`, `react-dom`, `antd`, `@nocobase/*`). Three plugins bundle OSI-licensed client or OIDC libraries at build or package time:

| Plugin | Bundled / Build-Time Packages | License | Output & Scope |
| :--- | :--- | :--- | :--- |
| `@latticedx/plugin-enterprise-auth` | `openid-client@6.8.9`, `jose@6.2.15`, `oauth4webapi@3.8.8` (`bundleDependencies`) | `MIT` | Locked in `package-lock.json`; preserves `LICENSE.md` files under `node_modules/` |
| `@latticedx/plugin-dxos-studio` | `@xyflow/react@12.12.1`, `@dagrejs/dagre@3.1.3`, `esbuild@0.28.2` (`devDependencies`) | `MIT` | Bundles LatticeFlow v2 canvas into `dist/client/index.js`; host UI stays external |
| `@latticedx/plugin-dxos-blocks` | `maplibre-gl@6.19.0` (`BSD-3-Clause`), `esbuild@0.28.2` (`MIT`) (`devDependencies`) | `BSD-3-Clause`, `MIT` | Bundles WebGIS + worker into `dist/client/index.js` with offline WGS84 fallback |
| Remaining 4 plugins (`action-bridge`, `foundation`, `dxos-para`, `dxos-ai`) | None | `Apache-2.0` | Uses only Node.js built-ins and host-provided NocoBase SDK globals |

## SPDX Header Compliance (`scripts/source-headers.mjs`)

Every first-party source and configuration file tracked in `lattice-dx` must carry the standardized 6-line copyright block and `SPDX-License-Identifier: Apache-2.0` before merging to `main`. `scripts/source-headers.mjs` validates and normalizes headers based on file extension.

### Standard Header Formats by File Type

<CodeTabs :tabs="[
  { label: 'JS / TS / MJS / CJS', lang: 'ts', code: '/**\n * @file LatticeDX — Open Digital Enterprise Platform\n * @author CTU-OpenPaw\n * @copyright (C) 2026 CTU-OpenPaw\n * @license Apache-2.0\n * @see https://github.com/CTU-OpenPaw/lattice-dx\n * SPDX-License-Identifier: Apache-2.0\n */' },
  { label: 'YAML / Shell / PS1 / Dockerfile', lang: 'yaml', code: '# @file LatticeDX — Open Digital Enterprise Platform\n# @author CTU-OpenPaw\n# @copyright (C) 2026 CTU-OpenPaw\n# @license Apache-2.0\n# @see https://github.com/CTU-OpenPaw/lattice-dx\n# SPDX-License-Identifier: Apache-2.0' },
  { label: 'SQL', lang: 'sql', code: '-- @file LatticeDX — Open Digital Enterprise Platform\n-- @author CTU-OpenPaw\n-- @copyright (C) 2026 CTU-OpenPaw\n-- @license Apache-2.0\n-- @see https://github.com/CTU-OpenPaw/lattice-dx\n-- SPDX-License-Identifier: Apache-2.0' },
  { label: 'CSS', lang: 'css', code: '/*\n * @file LatticeDX — Open Digital Enterprise Platform\n * @author CTU-OpenPaw\n * @copyright (C) 2026 CTU-OpenPaw\n * @license Apache-2.0\n * @see https://github.com/CTU-OpenPaw/lattice-dx\n * SPDX-License-Identifier: Apache-2.0\n */' }
]" />

### Processing Rules and Exclusions

The checker inspects all tracked files (`git ls-files --cached -z`) matching `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.css`, `.sql`, `.yml`, `.yaml`, `.ps1`, `.sh`, or `Dockerfile`. Leading UTF-8 BOM bytes and `#!` shebang lines are preserved in place above the header block.

<ParamGrid title="CLI Flags and Report Counters for scripts/source-headers.mjs" :items="[
  { name: '--check', type: 'flag', required: false, description: 'Read-only verification mode; exits with status 1 if any tracked file lacks a full header or requires review.' },
  { name: '--write', type: 'flag', required: false, description: 'Expands single-line SPDX-License-Identifier: Apache-2.0 markers into the full 6-line block on clean working tree files.' },
  { name: 'alreadyPresent', type: 'number', description: 'Count of tracked files already containing both @file LatticeDX and @copyright (C) 2026 CTU-OpenPaw.' },
  { name: 'wouldChange / changed', type: 'number', description: 'Count of files carrying a single-line SPDX marker eligible for automatic expansion.' },
  { name: 'needsReview', type: 'string[]', description: 'Files missing an explicit SPDX marker; the script refuses to infer ownership and exits non-zero.' }
]" />

Example JSON report when all tracked files pass verification:

```json
{
  "mode": "check",
  "changed": 0,
  "wouldChange": 0,
  "alreadyPresent": 412,
  "needsReview": []
}
```

Generated and vendor directories (`upstream`, `vendor`, `node_modules`, `dist`, `build`, `coverage`, `output`, `.next`, `.git`) along with lockfiles and generated declarations (`pnpm-lock.yaml`, `pnpm-workspace.yaml`, `next-env.d.ts`) are excluded automatically. In `--write` mode, if a target file has uncommitted edits in `git diff`, the script aborts with `Commit or preserve these pending edits first` to avoid overwriting in-progress work.

## Dependency Addition Checklist

Before introducing any new npm package or container image in a Pull Request, contributors run through four verification steps:

1. Confirm the declared license is OSI-approved and contains no `BSL-1.1` or `SSPL-1.0` restrictions in core workspace code.
2. Document the component license and upstream URL in `NOTICE`, `COPYRIGHT.txt`, and `docs/dependency-inventory.md`.
3. Regenerate `docs/sbom-cyclonedx.json` when lockfiles change and confirm zero production advisories at `low` severity or above.
4. Execute the local verification suite prior to pushing commits:

```sh
node scripts/source-headers.mjs --check
pnpm licenses list --json
pnpm release:sbom -- --check
pnpm audit --prod --audit-level=low
```

## Related

- [Third-Party Dependencies & NocoBase 2.2.50](/en/open-source/third-party-and-nocobase)
- [CycloneDX SBOM & Build from Source](/en/open-source/sbom-and-source-build)
- [Contributing, Security & Versioning Policy](/en/open-source/contributing-and-security)
- [7-Plugin Modular System](/en/architecture/plugin-system)
