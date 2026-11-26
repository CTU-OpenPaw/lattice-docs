---
title: Quickstart
description: Boot LatticeDX 0.4.2 locally via the isolated pnpm native:clean lab or the multi-service pnpm local:up development stack and verify service readiness.
---

# Quickstart

LatticeDX (`0.4.2`) ships two independent local startup workflows: an isolated single-command clean lab (`pnpm native:clean`) backed by `infra/compose/native-rehearsal.yml`, and a multi-service development stack (`pnpm local:up`) combining `core.yml` and `nocobase.yml`. All local development listeners bind strictly to `127.0.0.1` so unauthenticated lab services never expose ports on external interfaces.

## Workstation Prerequisites

Verify the required Pure-OSI toolchain versions before cloning the repository or installing workspace dependencies:

| Component | Required Version | Verification Command | Role in Workspace |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>=24 <25` (`24.x`) | `node -v` | Runs workspace builds (`TypeScript 7.0.2`), companion Fastify services, and all `7` NocoBase plugin builds. |
| **pnpm** | `10.23.0` | `pnpm -v` | Monorepo package and lockfile manager (`"packageManager": "pnpm@10.23.0"`). |
| **npm CLI** | Bundled with Node 24 | `npm -v` | Restores locked offline dependencies for `@latticedx/plugin-enterprise-auth` (`npm ci --ignore-scripts`). |
| **Git** | `2.30+` | `git --version` | Exports clean committed source via `git archive` during `pnpm native:clean`. |
| **tar** | GNU or BSD `tar` | `tar --version` | Extracts `source.tar` archives into isolated clean-lab directories. |
| **Docker Engine & Compose** | Compose `v2+` | `docker compose version` | Runs `nocobase/nocobase:2.2.50` alongside `pgvector`, `Valkey`, `Keycloak`, and `Apache APISIX`. |

On Windows 10/11 (WSL 2 + Docker Desktop), ensure Docker Desktop uses the `desktop-linux` context (`pnpm docker:start` invokes `scripts/docker-desktop.ps1`). If `pnpm@10.23.0` is not active, enable it via Corepack:

```sh
corepack enable
corepack prepare pnpm@10.23.0 --activate
```

## Path 1: Isolated Clean Lab (`pnpm native:clean`)

The `scripts/native-clean-install.mjs` runner exports committed `HEAD` source via `git archive`, verifies an empty `nocobase-db` (`0` tables in `public`), boots `nocobase/nocobase:2.2.50`, builds and enables all `7` `@latticedx/*` plugins, runs database migrations, and writes a structured execution report to `output/native-clean/<id>/report.json`.

<ParamGrid
  title="pnpm native:clean CLI Flags"
  :items="[
    { name: '--port', type: 'integer (13004..13999)', default: '13004', description: 'Loopback 127.0.0.1 port mapped to the isolated NocoBase container.' },
    { name: '--blank-slate', type: 'boolean flag', default: 'false', description: 'Sets LATTICE_SKIP_DEMO_SEED=1, asserts 0 seeded demo rows, runs the App Builder + MCP lifecycle check, and tears down on exit.' },
    { name: '--keep', type: 'boolean flag', default: 'false', description: 'Preserves the clean-lab containers and volumes after a --blank-slate verification run.' }
  ]"
/>

<CodeTabs
  :tabs="[
    {
      label: 'Clean Lab (Interactive)',
      lang: 'bash',
      code: 'git clone https://github.com/CTU-OpenPaw/lattice-dx.git\ncd lattice-dx\npnpm install --frozen-lockfile\npnpm native:clean -- --port=13004'
    },
    {
      label: 'Blank-Slate (Auto-Teardown)',
      lang: 'bash',
      code: 'pnpm native:clean -- --port=13005 --blank-slate'
    },
    {
      label: 'Blank-Slate (Keep Stack)',
      lang: 'bash',
      code: 'pnpm native:clean -- --port=13005 --blank-slate --keep'
    }
  ]"
/>

Execution phases inside `nativeCleanInstall`:

1. Generates a `12`-character hex `<id>` and assigns an isolated Docker Compose project (`lattice-native-clean-<id>`) after asserting zero pre-existing containers, volumes, or networks for that project name.
2. Starts `nocobase-db` (`pgvector/pgvector:0.8.1-pg16`) and asserts `SELECT count(*) FROM pg_tables WHERE schemaname='public'` equals `0`.
3. Starts `nocobase` (`nocobase/nocobase:2.2.50`) and polls `GET http://127.0.0.1:<port>/api/app:getLang` until HTTP `200`.
4. Captures a pre-install `pg_dump` backup, compiles all `7` plugins, packs offline `.tgz` tarballs inside the container, runs `yarn nocobase pm add` + `yarn nocobase pm enable`, and executes `yarn nocobase upgrade`.
5. Verifies all `/@latticedx/` migrations are recorded in `migrations`. Without `--blank-slate`, the script provisions local UI fixtures and prints `pageUrl` and `reportPath` to stdout.

## Path 2: Full Local Development Stack (`pnpm local:up`)

When developing against `Apache APISIX`, `Keycloak 26.8.2`, `ClamAV`, `@dx/api` (Fastify), `FIWARE Orion-LD`, or `n8n`, use `scripts/start-local.mjs` to validate and start `core.yml`, `nocobase.yml`, and optional `integration.yml` / `iiot.yml` stacks.

<CodeTabs
  :tabs="[
    {
      label: 'Core + NocoBase',
      lang: 'bash',
      code: 'cp .env.example .env\npnpm install --frozen-lockfile\npnpm local:up'
    },
    {
      label: 'With Orion-LD & n8n',
      lang: 'bash',
      code: '# Create .env.integration containing a 32+ char N8N_ENCRYPTION_KEY\necho N8N_ENCRYPTION_KEY=$(openssl rand -hex 24) > .env.integration\npnpm local:up -- --integration'
    },
    {
      label: 'Add IIoT Layer (Mosquitto + Node-RED)',
      lang: 'bash',
      code: 'docker compose -f infra/compose/iiot.yml up -d'
    }
  ]"
/>

After modifying plugin code under `plugins/nocobase/*`, rebuild and re-register all seven plugins into the running `nocobase.yml` container with a single command:

```sh
pnpm workspace:install
```

The `pnpm workspace:install` script writes a `pg_dump` snapshot to `output/backups/` before rebuilding all `7` plugins, recreating the `nocobase` container, and re-enabling every package through `yarn nocobase pm`.

## Service Readiness & Database Verification

Run `pnpm local:doctor` (`scripts/check-local.mjs`) to probe loopback metadata endpoints without writing records or invoking LLM providers:

<CodeTabs
  :tabs="[
    {
      label: 'Core Readiness',
      lang: 'bash',
      code: 'pnpm local:doctor'
    },
    {
      label: 'With Integration & Agent',
      lang: 'bash',
      code: 'pnpm local:doctor -- --integration --agent'
    },
    {
      label: 'Verify Plugins & PG FORCE RLS',
      lang: 'bash',
      code: 'docker compose -f infra/compose/nocobase.yml exec -T nocobase yarn nocobase pm list\ndocker compose -f infra/compose/nocobase.yml exec -T nocobase-db \\\n  psql -U nocobase -d nocobase -c \'SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname LIKE $$lattice%$$ ORDER BY relname LIMIT 10;\''
    }
  ]"
/>

Expected loopback endpoints for the local development stack:

| Service | Loopback Origin | Readiness Probe | Expected Response |
| :--- | :--- | :--- | :--- |
| **APISIX Gateway & Fastify API** | `http://127.0.0.1:8080` | `GET /ready` | `{"status":"ready","service":"api"}` |
| **Keycloak OIDC (`lattice`)** | `http://127.0.0.1:8081` | `GET /realms/lattice/.well-known/openid-configuration` | `issuer` matches `http://localhost:8081/realms/lattice` |
| **NocoBase Host (`2.2.50`)** | `http://127.0.0.1:13000` | `GET /api/app:getLang` | Non-empty `data.lang` string |
| **FIWARE Orion-LD (`1.12.0`)** | `http://127.0.0.1:1026` | `GET /version` | Contains `orionld version` field |
| **Stock n8n (`2.48.1`)** | `http://127.0.0.1:5678` | `GET /healthz` | `{"status":"ok"}` |
| **Node-RED (`4.0.9`)** | `http://127.0.0.1:1880` | `GET /` | HTTP status `< 500` |

<ApiEndpoint
  method="GET"
  path="/api/dxosAi:listProfiles"
  auth="Bearer JWT (root | ldx_admin)"
  summary="Confirms all 7 Agent Profiles (including dxos-architect) are bootstrapped and synced."
/>

## Security Boundaries & Teardown

### Pre-flight Collision Guards

`scripts/native-clean-install.mjs` aborts if the target Compose project already owns containers, volumes, or networks, and refuses to bootstrap against a non-empty `public` schema.

### Loopback Fixture Credentials

Credentials written to `output/native-platform/ui-lab.json` or defaulted in `.env.example` are strictly for `127.0.0.1` development. Never expose local lab ports externally; switch to `infra/compose/prod.yml` with generated secrets for live environments.

### Clean Teardown

Always stop local stacks and clean labs when finished to free host RAM and temporary volumes:

```sh
# Stop core + nocobase stacks
docker compose -f infra/compose/core.yml -f infra/compose/nocobase.yml down

# Stop full stack including integration and iiot
docker compose -f infra/compose/core.yml -f infra/compose/nocobase.yml -f infra/compose/integration.yml -f infra/compose/iiot.yml down

# Remove a specific clean-lab project ID from report.json
docker compose -p lattice-native-clean-<id> down -v --remove-orphans
```

## Related

- [Installation Profiles](/en/getting-started/installation-profiles) — Compare Compose files, the `5` production profiles, and CPU/RAM sizing limits.
- [Configuration](/en/getting-started/configuration) — Complete environment variable reference by subsystem.
- [Production Deployment](/en/getting-started/production-deployment) — Hardened Caddy TLS, APISIX, Keycloak MFA, and `nocobase_app` database setup.
- [Testing & Verification](/en/operations/testing-and-verification) — Unit, integration, and RLS isolation verification workflows.
