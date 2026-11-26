---
title: CycloneDX 1.5 SBOM & Build from Source
description: Deterministic CycloneDX 1.5 SBOM (257/257 resolved licenses, 0 NONE, 0 prod CVEs), 1,098 SPDX headers, and offline .tar.gz build-from-source guide for LatticeDX v0.4.2.
---

# CycloneDX 1.5 SBOM & Offline Build from Source (`v0.4.2`)

LatticeDX **`v0.4.2`** provides a machine-readable **CycloneDX 1.5 Software Bill of Materials (SBOM)**, **100% SPDX header coverage**, **zero production vulnerabilities**, and a **100% open-source offline build-from-source pipeline** validated on extracted `.tar.gz` archives without `.git/` metadata.

---

## 1. CycloneDX 1.5 SBOM (`257/257` Components, `0 NONE`)

The deterministic generator [`scripts/generate-sbom.mjs`](https://github.com/CTU-OpenPaw/lattice-dx/blob/main/scripts/generate-sbom.mjs) (`lattice-dx-sbom-generator` `0.4.2`) produces and verifies [`docs/sbom-cyclonedx.json`](https://github.com/CTU-OpenPaw/lattice-dx/blob/main/docs/sbom-cyclonedx.json):

```sh
pnpm release:sbom
pnpm release:sbom -- --check
pnpm audit --prod --audit-level=low
```

### Verified Baseline Metrics (`v0.4.2`)

| Metric | Verified Result | Notes |
| --- | --- | --- |
| **SBOM Specification** | `CycloneDX 1.5` (`specVersion: "1.5"`) | Deterministic output (`docs/sbom-cyclonedx.json`) |
| **Total Components** | **`257 / 257`** | `workspace = 12`, `npm = 226`, `oci = 19` |
| **Resolved Licenses** | **`257 / 257` (`0 NONE`)** | Includes platform-optional `fsevents@2.3.3 = MIT` |
| **Prohibited Licenses / Tech** | **`0` `BSL-1.1` / `ThingsBoard` / `EMQX`** | Hard-blocked by `BANNED_LICENSE_RE` & `BANNED_TECH_RE` |
| **Production Audit** | **`0` known vulnerabilities** | `pnpm audit --prod --audit-level=low` exits `0` |
| **SPDX First-Party Headers** | **`1,098` files verified** | `node scripts/source-headers.mjs --check` (`needsReview: []`) |

### Workspace Package License Distribution (`153` Grouped Entries)

From `pnpm licenses list --json` (`docs/dependency-inventory.md`), across **153** grouped npm package entries in the locked workspace:

| Declared SPDX Expression | Grouped Package Entries | Notable Packages |
| --- | ---: | --- |
| `MIT` | `115` | `Fastify` (`5.12.8`), `jose` (`6.2.12`), `pg` (`8.23.1`), `Vitest` (`5.0.3`), `tsx` (`4.23.15`), `esbuild` (`0.28.2`), `@xyflow/react` (`12.12.1`), `@dagrejs/dagre` (`3.1.3`), `zustand` (`4.5.7`) |
| `ISC` | `21` | `@maplibre/geojson-vt` (`6.3.3`), `@maplibre/maplibre-gl-style-spec` (`26.9.0`), `d3-*`, `earcut`, `kdbush`, `semver`, `picocolors` |
| `BSD-3-Clause` | `8` | `maplibre-gl` (`6.19.0`), `fast-uri` (`3.1.9`, `4.2.3`), `secure-json-parse` (`4.1.0`), `light-my-request` (`6.6.0`), `@mapbox/vector-tile`, `pbf`, `d3-ease`, `source-map-js` |
| `Apache-2.0` | `4` | `typescript` (`7.0.2`), `@typescript/typescript-win32-x64` (`7.0.2`), `detect-libc` (`2.1.2`), `expect-type` (`1.4.0`) |
| `BSD-2-Clause` | `2` | `@mapbox/tiny-sdf` (`2.3.0`), `@mapbox/unitbezier` (`1.0.0`) |
| `MPL-2.0` | `2` | `lightningcss` (`1.33.0`), `lightningcss-win32-x64-msvc` (`1.33.0`) |
| `(MIT OR Apache-2.0)` | `1` | `@maplibre/mlt` (`1.3.0`) |

> Note: Bundled dependencies in `@latticedx/plugin-enterprise-auth` (`openid-client@6.8.9`, `jose@6.2.15`, `oauth4webapi@3.8.8` — all `MIT`) are locked via `plugins/nocobase/plugin-enterprise-auth/package-lock.json` and tracked alongside the 19 `@sha256:` OCI images in `docs/sbom-cyclonedx.json`.

---

## 2. `1,098` SPDX Source Headers

Every first-party authored file supporting comments (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.css`, `.sql`, `.yml`, `.yaml`, `.ps1`, `.sh`, `Dockerfile`) carries the canonical CTU-OpenPaw header checked by `scripts/source-headers.mjs`:

```js
/**
 * @file LatticeDX — Open Digital Enterprise Platform
 * @author CTU-OpenPaw
 * @copyright (C) 2026 CTU-OpenPaw
 * @license Apache-2.0
 * @see https://github.com/CTU-OpenPaw/lattice-dx
 * SPDX-License-Identifier: Apache-2.0
 */
```

Verify across the entire repository:

```sh
node scripts/source-headers.mjs --check
```

Expected verified output: `mode: "check"`, `changed: 0`, `wouldChange: 0`, `alreadyPresent: 1098`, `needsReview: []`. Auto-generated `apps/web/next-env.d.ts` and lockfiles are explicitly excluded.

---

## 3. Offline `.tar.gz` Build-from-Source Walkthrough (`v0.4.2`)

This walkthrough reproduces **LatticeDX `v0.4.2`** from source using a **100% open-source toolchain** without modifying any source files or headers prior to compilation.

### Step 1: Required 100% OSS Toolchain

| Component | Verified Version | Role |
| --- | --- | --- |
| **Node.js** | `24.x` (`>=24 <25`) | Runtime for TypeScript/Node.js services (`file-scanner`, `agent-worker`, `api`) & build/PoF scripts |
| **pnpm** | `10.23.0` (`packageManager` in `package.json`) | Workspace & lockfile management (`pnpm-lock.yaml`) |
| **Git & tar** | Git + GNU/BSD `tar` | Source checkout or `.tar.gz` release extraction |
| **Docker Engine & Compose** | Docker Compose v2+ | Optional — required only to boot external OCI runtime services (`infra/compose/*.yml`) |

### Step 2: Acquire & Verify Source Code

Choose either the deterministic `.tar.gz` release archive (Method A — clean non-Git evaluation) or Git clone (Method B):

**Method A: From Release Archive (`.tar.gz`)**

```sh
sha256sum -c latticedx-0.4.2-src.tar.gz.sha256
tar -xzf latticedx-0.4.2-src.tar.gz
cd latticedx-0.4.2
```

On Windows PowerShell, compare hashes with:

```powershell
Get-FileHash .\latticedx-0.4.2-src.tar.gz -Algorithm SHA256
```

**Method B: From Official Git Repository**

```sh
git clone https://github.com/CTU-OpenPaw/lattice-dx.git
cd lattice-dx
```

> **No `git submodule` step required:** Both the Git repository and `latticedx-0.4.2-src.tar.gz` are 100% Pure-OSI with zero `upstream/nocobase/` or `.gitmodules`. Host `nocobase/nocobase:2.2.50` is pulled strictly at runtime as an external OCI container.

### Step 3: Optional Local Environment Variables

Offline compilation and unit tests work with defaults and require **no** edits to source files. Reference `.env.example` and `infra/compose/prod.env.example` if overriding ports:

```powershell
$env:API_PORT='4000'
$env:WORKER_PORT='4101'
$env:WORKER_URL='http://127.0.0.1:4101'
```

### Step 4: Install Dependencies & Verify the Monorepo

```sh
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` executes three sequential gates:
1. `pnpm typecheck`: Type-checks the entire monorepo workspace plus `solutions/logistics/tsconfig.json`.
2. `pnpm test`: Runs the Vitest suite (**`152` test files / `1,128` tests**).
3. `pnpm build`: Compiles `@dx/contracts`, `@dx/api`, `@dx/agent-worker`, and `@dx/file-scanner`.

*(Note: On memory-constrained Windows hosts, you can invoke `pnpm typecheck`, `pnpm test`, and `pnpm -r --workspace-concurrency=1 build` sequentially.)*

### Step 5: Build & Test All 7 NocoBase Plugins (`0.4.2`)

Each of the 7 `Apache-2.0` plugins declares `"sdkProvidedByHost": true` (`testedRuntime: "2.2.50"`) and builds offline without embedding upstream NocoBase source:

```sh
# 1. Restore locked dependencies for plugin-enterprise-auth (lifecycle scripts disabled)
npm ci --prefix plugins/nocobase/plugin-enterprise-auth --ignore-scripts --no-audit --no-fund

# 2. Build all 7 plugins
node plugins/nocobase/action-bridge/build.mjs
node plugins/nocobase/plugin-lattice-foundation/scripts/build.mjs
node plugins/nocobase/plugin-enterprise-auth/build.mjs
node plugins/nocobase/plugin-dxos-para/build.mjs
node plugins/nocobase/plugin-dxos-blocks/build.mjs
node plugins/nocobase/plugin-dxos-studio/build.mjs
node plugins/nocobase/plugin-dxos-ai/build.mjs

# 3. Run Node unit/integration tests (1,381 tests) + 163-case Vietnamese NL evaluation
node --test plugins/nocobase/*/tests/*.test.cjs scripts/tests/*.test.mjs tests/*.test.mjs
node scripts/eval-vietnamese-nl-agent.mjs --min-pass=95
```

Combined unit/integration verification across Vitest (`1,128`) and Node (`1,381`) totals **`2,509 / 2,509` passing tests**, plus **`163 / 163` (100%)** on the Vietnamese NL agent benchmark.

### Step 6: Run PoF Audit, SBOM Verification & Generate `.tar.gz`

```sh
node scripts/source-headers.mjs --check
pnpm pof:check
node --test scripts/tests/oss-pof-audit.test.mjs
pnpm release:sbom
node scripts/generate-sbom.mjs --check
pnpm release:tarball
```

- `pnpm release:tarball` runs `git archive --format=tar.gz` from committed `HEAD` to emit `output/release/latticedx-0.4.2-src.tar.gz` and `latticedx-0.4.2-src.tar.gz.sha256`, strictly excluding `node_modules/`, `output/`, `.env`, `.git/`, `.gitmodules`, and `upstream/`.
- `pnpm pof:check` runs identically inside the extracted `latticedx-0.4.2/` directory without `.git/`, confirming full non-Git reproducibility.

### Step 7: Optional Clean-Install Native Runtime & E2E Acceptance

When Docker Desktop / Docker Engine is available, bootstrap an isolated NocoBase `2.2.50` environment from a clean 0-table PostgreSQL database (`--port=13004..13999`, bound to `127.0.0.1` only) and run the acceptance suites:

```sh
pnpm native:clean --port=13014
# Or blank-slate mode (LATTICE_SKIP_DEMO_SEED=1):
# pnpm native:clean --port=13014 --blank-slate

node scripts/setup-native-multi-portal-demo.mjs "<path-to-report.json>"
node scripts/setup-native-workspace-demo.mjs "<path-to-report.json>"
pnpm setup:dxos-ai -- --origin=http://localhost:13014
NOCOBASE_ADMIN_PASSWORD="<admin-password>" node scripts/seed-v030-demo-showcase.mjs --origin=http://localhost:13014
NOCOBASE_ADMIN_PASSWORD="<admin-password>" pnpm seed:v100-showcase -- --origin=http://localhost:13014
pnpm acceptance:headless-paas -- --origin=http://localhost:13014
pnpm acceptance:dxos-ai-mcp -- --origin=http://localhost:13014
pnpm acceptance:logistics-rbac -- "<path-to-report.json>"
```

### Related Governance Pages

- [Pure-OSI `Apache-2.0` Policy & PoF Matrix](/en/oss/pure-osi-policy)
- [NocoBase `2.2.50` Clause 5.2 Attribution & Source Boundary](/en/oss/nocobase-clause-5-2)
- [Contributing, Security Policy & Release Changelog](/en/oss/contributing-security-changelog)
