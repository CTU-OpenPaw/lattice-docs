---
title: Contributing, Security & Versioning Policy
description: Contribution workflow, Pull Request and CodeQL standards, private vulnerability disclosure, and pre-major 0.x versioning policy for LatticeDX v0.4.2.
---

# Contributing, Security & Versioning Policy

Contributing to **LatticeDX `v0.4.2`** follows clear monorepo module boundaries, automated CI and CodeQL verification, and private vulnerability disclosure to keep the `Apache-2.0` Pure-OSI codebase clean and auditable.

## Development Environment & Code Conventions

Local development requires **Node.js `24.x`** (`>=24 <25`), **pnpm `10.23.0`**, **Git**, **tar**, and **Docker Compose v2+** (when validating container stacks). Install workspace dependencies from the locked manifest:

```sh
git clone https://github.com/CTU-OpenPaw/lattice-dx.git
cd lattice-dx
pnpm install --frozen-lockfile
```

Contributors follow four structural rules when modifying the codebase:

| Rule | Scope | Technical Requirement |
| :--- | :--- | :--- |
| **Directory layout** | Full repository | Place standalone services under `apps/`, shared contracts under `packages/`, NocoBase extensions under `plugins/nocobase/`, and deployment files under `infra/`. |
| **Modular boundaries** | `apps/`, `packages/`, `plugins/` | Keep new source files focused (recommended under `300` lines per file). Never import internal source paths across `apps/*`; communicate via `@dx/contracts` or HTTP/REST APIs. |
| **Generated files and purity** | Git working tree | Never edit generated `apps/web/next-env.d.ts`, never add `.gitmodules` or `upstream/` directories, and never commit `.env`, `*.pem`/`*.key` files, or credentials. |
| **Licenses and SPDX headers** | All new source files | Include the 6-line `@copyright (C) 2026 CTU-OpenPaw` and `SPDX-License-Identifier: Apache-2.0` header; every new dependency must be OSI-approved and added to `NOTICE` and `docs/dependency-inventory.md`. |

## Issue Tracking & Pull Request Workflow

The CTU-OpenPaw ecosystem separates repositories by responsibility: `lattice-dx` hosts the core platform, `lattice-docs` contains VitePress documentation, `lattice-templates` provides Solution Bundle v3 artifacts, and `.github` manages organization-level governance. Issues on `CTU-OpenPaw/lattice-dx` use structured templates under `.github/ISSUE_TEMPLATE/`:

| Template / Config File | Purpose |
| :--- | :--- |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | Reproducible bug reports with environment, version, and minimal logs |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | Proposals for new capabilities, APIs, or studio blocks |
| `.github/ISSUE_TEMPLATE/question_or_doc.md` | Technical questions or documentation improvements |
| `.github/ISSUE_TEMPLATE/config.yml` | Disables blank issues (`blank_issues_enabled: false`) and routes security reports to Security Advisories |

Commit messages follow **Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`).

### Pre-Submission Pull Request Checklist

The `.github/PULL_REQUEST_TEMPLATE.md` template requires contributors to verify the following gates prior to review:

| Verification Gate | Acceptance Criterion |
| :--- | :--- |
| **SPDX headers & Pure-OSI** | Passing `node scripts/source-headers.mjs --check` and `pnpm release:sbom -- --check` |
| **Pre-major `0.4.x` lock** | Version remains `0.4.2` with no unapproved bump to `1.0.0` |
| **NocoBase `2.2.50` boundary** | Preserves `Powered by NocoBase`, `"sdkProvidedByHost": true`, and zero `upstream/` or `.gitmodules` |
| **Tenant isolation & RBAC** | Verifies PostgreSQL 16 `FORCE RLS` policies and RBAC guards when touching models, migrations, or routes |
| **Hygiene & test suites** | Zero secrets/PII, `@sha256:` pinned images, passing `pnpm check` and `node --test` |

<CodeTabs :tabs="[
  { label: 'Core & SPDX Checks', lang: 'sh', code: 'pnpm check\nnode scripts/source-headers.mjs --check\npnpm release:sbom -- --check\npnpm audit --prod --audit-level=low' },
  { label: 'Plugin & Externals Tests', lang: 'sh', code: 'node --test \\\n  plugins/nocobase/*/tests/*.test.cjs \\\n  scripts/tests/*.test.mjs \\\n  tests/native-ui-fixture.test.mjs \\\n  tests/nocobase-externals.test.mjs' },
  { label: 'Compose Validation', lang: 'sh', code: 'docker compose -f infra/compose/core.yml config --quiet\ndocker compose -f infra/compose/nocobase.yml config --quiet\ndocker compose --env-file infra/compose/prod.env.example \\\n  -f infra/compose/prod.yml --profile n8n --profile iiot \\\n  --profile observability --profile pdf --profile iam-sync config --quiet' }
]" />

## Automated CI & CodeQL Standards

Every Pull Request targeting `main` on `CTU-OpenPaw/lattice-dx` runs two automated workflows in `.github/workflows/`:

| Workflow | Job | Verification Scope |
| :--- | :--- | :--- |
| **`Check` (`ci.yml`)** | `check` | Runs `pnpm check` (`typecheck`, `vitest`, `build`), `source-headers.mjs --check`, `release:sbom -- --check`, `eval-vietnamese-nl-agent.mjs --min-pass=95`, naming hygiene checks, and `node --test` across all 7 plugins |
| **`Check` (`ci.yml`)** | `dependency-audit` | Executes `pnpm audit --prod --audit-level=moderate` and `pnpm audit --prod --audit-level=low` (`0` unresolved production vulnerabilities) |
| **`Check` (`ci.yml`)** | `compose-validate` | Runs `docker compose config --quiet` across `core.yml`, `nocobase.yml`, `native-rehearsal.yml`, `integration.yml`, `native-files.yml`, `uc1-sample.yml`, `iiot.yml`, and all `prod.yml` profiles |
| **`Check` (`ci.yml`)** | `trivy-scan` | Scans repository filesystem for `vuln`, `misconfig`, and `secret` findings at `CRITICAL,HIGH` severity via `aquasecurity/trivy-action` (`ignore-unfixed: true`) |
| **`CodeQL` (`codeql.yml`)** | `Analyze (javascript-typescript)` | Runs `github/codeql-action/init@v4` with `security-extended` queries (`build-mode: none`) on pushes/PRs to `main` and weekly scheduled scans (`0 3 * * 1`), uploading SARIF reports |

### CI Hygiene and CodeQL SARIF Retention

The `CodeQL` workflow writes SARIF output to `sarif-results/` and retains the build artifact for `14` days for security triage. For public repositories, SARIF findings upload directly to the GitHub Security tab (`upload: always`).

Beyond compilation and dependency audits, the `check` job enforces two automated repository hygiene checks:
1. Rejects tracked `.env` files (other than `.env.example`), private key files (`*.pem`, `*.key`), or embedded credential tokens.
2. Runs `git grep` naming hygiene checks across tracked files to ensure retired terminology does not reappear in product code or deployment configs.

## Security Boundaries & Fixture Credentials Warning

Security patches are actively supported on the **`0.4.x`** release line (`main` on `CTU-OpenPaw/lattice-dx`).

### Loopback Fixture Credentials Warning

Default templates in `.env.example` and `infra/compose/*.yml` include public fixture credentials strictly for isolated `127.0.0.1` / `localhost` testing. Never expose these fixture values to untrusted networks or production data. Before any non-loopback deployment, operators must rotate every secret listed below and configure valid TLS certificates on Caddy:

| Fixture Variable | Loopback Fixture Value | Production Requirement |
| :--- | :--- | :--- |
| `POSTGRES_PASSWORD` / `POSTGRES_SUPERUSER_PASSWORD` | `local-demo-password` | Unique strong passwords separating `postgres` from `*_app` roles |
| `NOCOBASE_DB_PASSWORD` / `NOCOBASE_APP_DB_PASSWORD` | `local-nocobase-password` | Distinct credentials for migration (`nocobase`) vs `NOBYPASSRLS` runtime (`nocobase_app`) |
| `REDIS_PASSWORD` | `local-redis-password` | High-entropy secret for Valkey `8.1` (`CACHE_REDIS_URL`, `PUBSUB_ADAPTER_REDIS_URL`, DB 2) |
| `NOCOBASE_APP_KEY` / `NOCOBASE_ENCRYPTION_FIELD_KEY` | Public fixture placeholder | >=32-char / 32-byte keys used for JWT signing and AES-256-GCM key wrapping |
| `APISIX_OIDC_CLIENT_SECRET` / `LATTICE_TRACK_VERIFY_SECRET` | Sample integration value | Provisioned Keycloak `dx-gateway` secret and HMAC key for `/v/track/:code` QR proofs |

### Implemented Security Controls

| Security Layer | Enforcement Mechanism |
| :--- | :--- |
| **Identity & sessions** | Fastify Core API validates Keycloak JWT signatures (`OIDC_ISSUER` / `OIDC_JWKS_URL`) and optimistic locking via `expectedVersion`. `@latticedx/plugin-enterprise-auth` enforces Authorization Code + PKCE `S256` with Valkey DB 2 session revocation. |
| **Row-level multi-tenancy** | PostgreSQL 16 enforces `FORCE ROW LEVEL SECURITY` across 56 static tables and dynamic `latticeCustom*` tables under the non-superuser `nocobase_app` role (`NOBYPASSRLS`), binding `app.current_org` per transaction. |
| **Upload malware scanning** | `apps/file-scanner` streams uploaded attachments through ClamAV (`clamav/clamav:1.5.5`) over TCP before allowing object downloads from RustFS S3. |
| **Container immutability** | All 19 OCI container images in `infra/compose/*.yml` pin immutable `@sha256:` digests. |

## Private Vulnerability Disclosure

Never disclose security vulnerabilities, API tokens, `.env` files, or private keys in public GitHub Issues or Pull Requests.

Report security issues privately via **GitHub Security Advisories**:

```text
https://github.com/CTU-OpenPaw/lattice-dx/security/advisories/new
```

Include a concise description of affected components, minimal reproduction steps, and the relevant commit SHA or version tag so maintainers can triage and coordinate remediation.

## Pre-Major `0.x` Versioning Policy (`0.4.2`)

LatticeDX follows pre-major (`< 1.0.0`) Semantic Versioning and is locked across the ecosystem at **`0.4.2`**:

<ParamGrid title="LatticeDX 0.x Pre-Major Versioning Rules" :items="[
  { name: '0.4.2', type: 'current', required: true, description: 'Current synchronized release across root package.json, all 7 NocoBase plugins, lattice-docs, and release tarballs.' },
  { name: '0.4.x (PATCH)', type: 'compatible', description: 'Security patches, runtime fixes, and verification updates preserving compatibility with NocoBase 2.2.50 and Solution Bundle v3.' },
  { name: '0.x.0 (MINOR)', type: 'breaking-pre-1', description: 'Reserved for schema changes, internal API evolutions, or plugin contract updates prior to stabilizing at 1.0.0.' },
  { name: '< 1.0.0 lock', type: 'policy', required: true, description: 'Releases remain below 1.0.0 until long-term public API stability guarantees are finalized across all repositories.' }
]" />

Every patch release in the `0.4.x` line synchronizes version numbers across:
- Root `package.json` (`"version": "0.4.2"`).
- All seven `plugins/nocobase/*/package.json` manifests (`"version": "0.4.2"`).
- `lattice-docs/package.json` (`"version": "0.4.2"`).
- `COPYRIGHT.txt`, `docs/sbom-cyclonedx.json`, and the source archive filename `latticedx-0.4.2-src.tar.gz`.

### Pre-Release Verification Workflow

Before tagging a `0.4.x` release commit, maintainers execute the full release verification sequence:

```sh
pnpm check
node scripts/source-headers.mjs --check
pnpm release:sbom -- --check
pnpm audit --prod --audit-level=low
pnpm release:tarball --ref=HEAD
```

The generated `output/release/latticedx-0.4.2-src.tar.gz` archive and its `.sha256` checksum file are extracted into a clean directory to verify standalone compilation without `.git/` metadata.

## Related

- [Licensing & Pure-OSI Policy](/en/open-source/licensing)
- [CycloneDX SBOM & Build from Source](/en/open-source/sbom-and-source-build)
- [Zero-Trust Security Model](/en/architecture/security-model)
- [PostgreSQL FORCE RLS Multi-Tenancy](/en/architecture/multi-tenancy-rls)
