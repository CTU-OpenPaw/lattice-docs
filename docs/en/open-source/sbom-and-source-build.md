---
title: CycloneDX SBOM & Build from Source
description: Deterministic CycloneDX 1.5 SBOM verification, reproducible build from source for LatticeDX v0.4.2, clean-room tarball packaging, and SHA-256 container pinning.
---

# CycloneDX SBOM & Build from Source

LatticeDX `v0.4.2` builds end to end from source using 100% open-source tooling, backed by a deterministic **CycloneDX 1.5** Software Bill of Materials (`docs/sbom-cyclonedx.json`) and immutable `@sha256:` digest pinning across all OCI container images.

## Required OSS Toolchain

Building and verifying the workspace from source requires no proprietary compilers and zero manual edits to source headers prior to compilation.

| Tool | Verified Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `24.x` (`>=24 <25`) | Executes build scripts, verification suites, and backend services (`@dx/api`, `@dx/agent-worker`, `@dx/file-scanner`) |
| **pnpm** | `10.23.0` | Manages monorepo workspaces and enforces `pnpm-lock.yaml` (`packageManager` in root `package.json`) |
| **Git & tar** | Git + GNU/BSD `tar` | Checks out source commits and creates or extracts `latticedx-0.4.2-src.tar.gz` |
| **Docker Engine & Compose** | Compose v2+ | Optional — validates Compose manifests and runs external OCI services (`infra/compose/*.yml`) |

## CycloneDX 1.5 SBOM Verification (`scripts/generate-sbom.mjs`)

`docs/sbom-cyclonedx.json` is generated directly from locked repository manifests by `scripts/generate-sbom.mjs`. Output generation is deterministic: identical repository trees and lockfiles always produce the exact same `serialNumber` (`urn:uuid:...` derived via SHA-256 over `CycloneDX/1.5`, the root `bom-ref`, and ordered component hashes) and identical JSON formatting.

### Component Breakdown (`257` Total Components)

| Component Source | Count | Extraction Logic in `generate-sbom.mjs` |
| :--- | :---: | :--- |
| **Workspace Packages** | `12` | `collectWorkspaceComponents()` scans root `package.json`, `apps/*`, `packages/*`, and `plugins/nocobase/*`. |
| **npm Dependencies** | `226` | `parsePnpmLockPackages()` (`pnpm-lock.yaml`) and `parseNpmPackageLock()` (`plugin-enterprise-auth/package-lock.json`); maps integrity digests to `SHA-512`/`SHA-256` and resolves licenses via installed manifests and platform rules (including `fsevents@2.3.3 = MIT`). |
| **OCI Containers** | `19` | `parseComposeImages()` scans `infra/compose/*.yml`, requires `@sha256:<64-hex>` digests, emits `pkg:oci/...` PURLs, and resolves licenses via `OCI_IMAGE_LICENSES`. |

### Excerpt from `docs/sbom-cyclonedx.json`

```json
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.5",
  "serialNumber": "urn:uuid:263d04fa-0790-4509-8cf5-0e09184dcd1a",
  "version": 1,
  "metadata": {
    "tools": {
      "components": [
        { "type": "application", "name": "lattice-dx-sbom-generator", "version": "0.4.2" }
      ]
    },
    "component": {
      "type": "application",
      "bom-ref": "pkg:npm/lattice-dx@0.4.2",
      "name": "lattice-dx",
      "version": "0.4.2",
      "purl": "pkg:npm/lattice-dx@0.4.2",
      "licenses": [{ "license": { "id": "Apache-2.0" } }]
    }
  }
}
```

### Platform Binary License Resolution and Policy Guards

Cross-platform lockfiles include OS-specific optional packages (such as `fsevents@2.3.3` on macOS or native prebuilt bindings for `esbuild`, `rolldown`, `typescript`, `lightningcss`, `sharp`, and `next`). `generate-sbom.mjs` resolves licenses across sibling platform packages via `PLATFORM_BINARY_FAMILIES` and `PLATFORM_OPTIONAL_PACKAGE_LICENSES` so all `257` components carry explicit license metadata (`0` unresolved entries).

Before writing or verifying output, `generate-sbom.mjs` runs three hard guards:

- `assertAllowedLicense()` rejects any license matching `BSL-1.1` or `Business Source License`.
- `assertAllowedComponentName()` rejects any dependency or container referencing `thingsboard` or `emqx`.
- `parseComposeImages()` fails immediately if any `image:` declaration in `infra/compose/*.yml` lacks an immutable `@sha256:<64-hex>` digest.

<ParamGrid title="CLI Flags for scripts/generate-sbom.mjs" :items="[
  { name: '--check', type: 'flag', default: 'false', description: 'Performs byte-for-byte drift verification against docs/sbom-cyclonedx.json; exits with status 1 on mismatch.' },
  { name: '--out=<path>', type: 'string', default: 'docs/sbom-cyclonedx.json', description: 'Output path for the generated CycloneDX 1.5 JSON document.' },
  { name: '--json', type: 'flag', default: 'false', description: 'Prints machine-readable summary JSON (with --check/--out) or writes the full SBOM to stdout.' },
  { name: '--root=<dir>', type: 'string', default: 'REPO_ROOT', description: 'Overrides the repository root directory, useful when verifying extracted release archives.' }
]" />

<CodeTabs :tabs="[
  { label: 'Verify SBOM', lang: 'sh', code: 'pnpm release:sbom -- --check\nnode scripts/generate-sbom.mjs --check --json' },
  { label: 'Regenerate SBOM', lang: 'sh', code: 'pnpm release:sbom\nnode scripts/generate-sbom.mjs --out=docs/sbom-cyclonedx.json' }
]" />

## Reproducible Build from Source (`v0.4.2`)

### Step 1: Obtain and Verify Source

Obtain the source tree either from the verified release archive or by cloning the Git repository. Neither path contains `.gitmodules` or requires `git submodule` initialization.

<CodeTabs :tabs="[
  { label: 'Release Archive (Linux/macOS)', lang: 'sh', code: 'sha256sum -c latticedx-0.4.2-src.tar.gz.sha256\ntar -xzf latticedx-0.4.2-src.tar.gz\ncd latticedx-0.4.2' },
  { label: 'Release Archive (PowerShell)', lang: 'powershell', code: 'Get-FileHash .\\latticedx-0.4.2-src.tar.gz -Algorithm SHA256\ntar -xzf .\\latticedx-0.4.2-src.tar.gz\ncd .\\latticedx-0.4.2' },
  { label: 'Git Clone', lang: 'sh', code: 'git clone https://github.com/CTU-OpenPaw/lattice-dx.git\ncd lattice-dx' }
]" />

### Step 2: Install Dependencies and Build the Monorepo

```sh
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` executes three sequential verification stages:
1. `pnpm typecheck`: runs TypeScript type checking across all workspace packages and `solutions/logistics/tsconfig.json`.
2. `pnpm test`: executes Vitest suites across `tests/**/*.test.ts`, `apps/*/src/**/*.test.ts`, and `packages/*/src/**/*.test.ts`.
3. `pnpm build`: compiles `@dx/contracts`, `@dx/api`, `@dx/agent-worker`, and `@dx/file-scanner`.

### Step 3: Build and Test All Seven NocoBase Plugins

All seven `0.4.2` plugins bind host packages via `"sdkProvidedByHost": true` and compile independently through their build entrypoints:

| Plugin | Build Command | Primary Artifacts |
| :--- | :--- | :--- |
| `@latticedx/plugin-action-bridge` | `node plugins/nocobase/action-bridge/build.mjs` | `dist/` and `dist/externalVersion.js` |
| `@latticedx/plugin-lattice-foundation` | `node plugins/nocobase/plugin-lattice-foundation/scripts/build.mjs` | `dist/server/index.js`, `dist/client/index.js`, `dist/client-v2/index.js` |
| `@latticedx/plugin-enterprise-auth` | `node plugins/nocobase/plugin-enterprise-auth/build.mjs` | `dist/server/index.js`, `dist/client/index.js`, `dist/client-v2/index.js` |
| `@latticedx/plugin-dxos-para` | `node plugins/nocobase/plugin-dxos-para/build.mjs` | `dist/server/index.js`, `dist/client/index.js`, `dist/client-v2/index.js` |
| `@latticedx/plugin-dxos-blocks` | `node plugins/nocobase/plugin-dxos-blocks/build.mjs` | `dist/client/index.js` (with MapLibre GL), `dist/server/index.js` |
| `@latticedx/plugin-dxos-studio` | `node plugins/nocobase/plugin-dxos-studio/build.mjs` | `dist/client/index.js` (with `@xyflow/react`), `dist/server/index.js` |
| `@latticedx/plugin-dxos-ai` | `node plugins/nocobase/plugin-dxos-ai/build.mjs` | `dist/server/index.js`, `dist/client/index.js`, `dist/client-v2/index.js` |

```sh
# Install locked runtime dependencies for plugin-enterprise-auth with lifecycle scripts disabled
npm ci --prefix plugins/nocobase/plugin-enterprise-auth --ignore-scripts --no-audit --no-fund

# Build all 7 plugins and run unit tests
for script in \
  plugins/nocobase/action-bridge/build.mjs \
  plugins/nocobase/plugin-lattice-foundation/scripts/build.mjs \
  plugins/nocobase/plugin-enterprise-auth/build.mjs \
  plugins/nocobase/plugin-dxos-para/build.mjs \
  plugins/nocobase/plugin-dxos-blocks/build.mjs \
  plugins/nocobase/plugin-dxos-studio/build.mjs \
  plugins/nocobase/plugin-dxos-ai/build.mjs; do
  node "$script"
done

node --test plugins/nocobase/*/tests/*.test.cjs scripts/tests/*.test.mjs tests/nocobase-externals.test.mjs
```

## Source Release Tarball Packaging (`scripts/build-oss-release-tarball.mjs`)

Running `pnpm release:tarball` generates `output/release/latticedx-0.4.2-src.tar.gz` and `latticedx-0.4.2-src.tar.gz.sha256` using `git archive` against a verified commit SHA (`--ref=HEAD` by default or `--ref=<tag|sha>`).

Before renaming the temporary archive to its final output path, `assertTarballEntries()` validates the archive contents:
- **Required files (`REQUIRED_ENTRIES`):** `LICENSE`, `NOTICE`, `COPYRIGHT.txt`, `README.md`, `CHANGELOG.md`, and `docs/build-from-source.md`.
- **Forbidden paths (`FORBIDDEN_ENTRY_PATTERNS`):** `node_modules/`, `output/`, `.git/`, any `.env*` file except `.env.example`, `*.pem`, `*.key`, `upstream/`, and `.gitmodules`.

### Clean-Room Tarball Rebuild Check

To verify that the release archive builds independently without `.git/` history, extract it into a fresh directory and re-run workspace checks and SBOM verification:

```sh
mkdir clean-verify && tar -xzf output/release/latticedx-0.4.2-src.tar.gz -C clean-verify
cd clean-verify/latticedx-0.4.2
pnpm install --frozen-lockfile
pnpm check
node scripts/generate-sbom.mjs --check
```

## Immutable SHA-256 Container Pinning

Every service defined in `infra/compose/*.yml` pins an immutable `@sha256:<64-hex>` digest instead of mutable tags. The table below lists all 19 pinned container digests for `v0.4.2`:

| Image | SHA-256 Digest (`@sha256:...`) |
| :--- | :--- |
| `nocobase/nocobase:2.2.50` | `04b75164936e7314ef74d82844bc56c9f34ed7ff1ca976ca53ffac2d3c88d777` |
| `postgres:16.16-alpine` | `f2f98726820d0342055351c6e9d36e705f5bfffb3dd53ff556325114b08afb6d` |
| `pgvector/pgvector:0.8.1-pg16` | `33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337` |
| `valkey/valkey:8.1-alpine` | `9971099af41c36e887aabdfe22b80c0fe45df949163dfc9cb434febc57cfc3fc` |
| `rustfs/rustfs:1.0.6` | `ee717072290bec9b11abfc0365f8310b00df1cd9b3639943edae47bdef05044a` |
| `caddy:2.10-alpine` | `4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d` |
| `quay.io/keycloak/keycloak:26.8.2` | `7e66a96e4739239070aeaf72e4c5decf0f7f682cfc725b9f7ea2b336eaba38b3` |
| `adorsys/keycloak-config-cli:6.5.1-26` | `1b22dfaa9ae0c71f74b0342f9221a6510f272da5def683dbba26a98e6b1b1411` |
| `apache/apisix:3.19.0-debian` | `9a7e45dc943fbf10ec916d1232bae4cda9302ae28a4696cfb83c2da01d261141` |
| `clamav/clamav:1.5.5` | `12177441d1b40cef3c47b44c4090d59d4babc4c67bedd5af0fa315e603aa6dd8` |
| `fiware/orion-ld:1.12.0` | `f562a93ed84cccae05063688e1c3605f75060d0c7b9cd004561eec43bcbd613b` |
| `mongo:8.0` | `479e85ced54ffb8a40dade1dcde2da2a9ae858515b9415e9cc54bfb8f0575d01` |
| `n8nio/n8n:2.48.1` | `5e022f23ef9eaac3f51467e021610c218ed7eb5b41a05edb388ef1c8e00e009f` |
| `eclipse-mosquitto:2.0.21` | `94f5a3d7deafa59fa3440d227ddad558f59d293c612138de841eec61bfa4d353` |
| `nodered/node-red:4.0.9` | `0b295b3a14c512548567ca99db631bc37b23bfc79fd009ee8248a610fafdb4b5` |
| `otel/opentelemetry-collector-contrib:0.123.0` | `e39311df1f3d941923c00da79ac7ba6269124a870ee87e3c3ad24d60f8aee4d2` |
| `prom/prometheus:v3.3.0` | `339ce86a59413be18d0e445472891d022725b4803fab609069110205e79fb2f1` |
| `grafana/grafana-oss:11.5.8` | `b8121de93047fd77c77de806bae9706e7d60de21c3bd5381a5db0167f94c6a48` |
| `gotenberg/gotenberg:8.20.1` | `cda4386c7ed38f18bc6897828be01ba7361c99929a5c84ec5e293d7916e29bac` |

Validate all Compose definitions and profiles prior to deployment:

```sh
docker compose --env-file infra/compose/prod.env.example -f infra/compose/prod.yml \
  --profile n8n --profile iiot --profile observability --profile pdf --profile iam-sync config --quiet
```

## Related

- [Licensing & Pure-OSI Policy](/en/open-source/licensing)
- [Third-Party Boundaries & NocoBase 2.2.50](/en/open-source/third-party-and-nocobase)
- [Docker Compose Installation Profiles](/en/getting-started/installation-profiles)
- [Testing & Verification Workflows](/en/operations/testing-and-verification)
