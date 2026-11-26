---
title: Requirements & Sizing
description: Hardware, software toolchain, default ports, container resource sizing, and Pure-OSI runtime prerequisites for LatticeDX v0.4.2.
---

# Hardware & Software Requirements (`v0.4.2`)

**LatticeDX `v0.4.2`** is engineered as a **100% Pure-OSI (`Apache-2.0`)** open-source Digital Enterprise Operating Platform (`DX-OS Open-Core`). All host builds, plugin compilations, and containerized runtime stacks rely exclusively on OSI-approved open-source tools and container images.

## 1. Software Toolchain (100% Pure-OSI)

Verify the following toolchain versions on your workstation or build server before cloning or extracting `latticedx-0.4.2-src.tar.gz`:

| Component | Required Version | Verification Command | Role in LatticeDX |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>=24 <25` (`24.x`) | `node -v` | Workspace build (`TypeScript 7.0.2`, `tsx`, `Vitest`), `@dx/api`, `@dx/agent-worker`, `@dx/file-scanner`, 7 NocoBase plugin builds, and CLI scripts (`native:clean`, `pof:check`, `release:sbom`) |
| **pnpm** | `10.23.0` | `pnpm -v` | Monorepo workspace & lockfile manager (`"packageManager": "pnpm@10.23.0"` in `package.json`) |
| **npm CLI** | Bundled with Node 24 | `npm -v` | Offline locked dependency restoration for `@latticedx/plugin-enterprise-auth` (`npm ci --ignore-scripts`) |
| **Git** | `2.30+` | `git --version` | Repository checkout and deterministic `git archive` source export in `pnpm native:clean` and `pnpm release:tarball` |
| **tar** | GNU or BSD `tar` | `tar --version` | Extracting committed source archives (`source.tar`) and release tarballs (`latticedx-0.4.2-src.tar.gz`) |
| **Docker Engine & Compose** | Docker Compose `v2+` | `docker compose version` | Running external OCI host runtime (`nocobase/nocobase:2.2.50`) and supporting infrastructure (`infra/compose/*.yml`) |

::: tip Corepack for Exact `pnpm 10.23.0`
If `pnpm` is not installed or is on a different major version, enable Corepack with Node.js `24.x`:
```sh
corepack enable
corepack prepare pnpm@10.23.0 --activate
```
:::

### Supported Operating Systems

- **Linux (`x86_64` / `arm64`)** — Recommended for production deployments (`infra/compose/prod.yml`), CI/CD, and release verification.
- **Windows 10 / 11 (WSL 2 + Docker Desktop)** — Supported for local development, `Vitest` / `node --test` suites, and clean-install rehearsal (`pnpm native:clean`). Set Docker Desktop to the `desktop-linux` context (`scripts/docker-desktop.ps1`).
- **macOS (Apple Silicon / Intel)** — Supported for local development and containerized clean-install labs via Docker Desktop or compatible Docker daemon (`DOCKER_CONTEXT`).

## 2. Pure-OSI Host & Dependency Boundary

LatticeDX enforces strict **Pure-OSI License Hygiene** (`0` `BSL-1.1`, `0` proprietary source dependencies):

- **Zero Embedded Upstream Source:** The Git repository and `latticedx-0.4.2-src.tar.gz` contain **no `.gitmodules`** and **no `upstream/nocobase/`** tree. The 7 LatticeDX plugins under `plugins/nocobase/*` declare `"sdkProvidedByHost": true` (`testedRuntime: "2.2.50"`).
- **External OCI Host Runtime:** `nocobase/nocobase:2.2.50` is pulled strictly as a digest-pinned OCI container at runtime while preserving **NocoBase License Agreement Clause 5.2** attribution (`Powered by NocoBase`, `v2.2.50`).
- **Pure-OSI Infrastructure Replacements:**
  - **Valkey `8.1`** (`valkey/valkey:8.1-alpine`, `BSD-3-Clause`) for Redis-compatible cache, pub/sub, and APISIX rate-limiting.
  - **PostgreSQL `16.16`** + **`pgvector 0.8.1`** for relational `FORCE RLS`, Hybrid RAG (`HNSW` + `tsvector`), and IIoT time-series storage (`latticeTelemetryPoints`) — zero TimescaleDB dependency.
  - **Eclipse Mosquitto `2.0.21`** (`EPL-2.0 OR BSD-3-Clause`) + **Node-RED `4.0.9`** (`Apache-2.0`) + **FIWARE Orion-LD `1.12.0`** (`AGPL-3.0` / external OCI service) — zero EMQX or ThingsBoard.

## 3. Hardware & Resource Sizing

Resource allocations below are derived directly from the explicit `mem_limit` and `cpus` constraints defined in `infra/compose/*.yml`.

| Deployment Tier | Compose / Script | CPU (Min / Rec.) | RAM (Min / Rec.) | Disk Space | Included Workloads |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Offline Source & Test Only** | `pnpm check` & `node --test` | `2` / `4` vCPU | `4 GB` / `8 GB` | `4 GB` free | TypeScript `7.0.2`, `Vitest`, `node --test` (`2,509` tests), 7 plugin `esbuild` builds, PoF & SBOM audit |
| **1-Command Clean Lab** | `pnpm native:clean --port=13014` (`native-rehearsal.yml`) | `2` / `4` vCPU | `4 GB` / `8 GB` | `10 GB` free | `pgvector:0.8.1-pg16` (`512m`) + `nocobase:2.2.50` (`1536m`) + local plugin build |
| **Full Local Dev Stack** | `core.yml` + `nocobase.yml` (+ optional `integration.yml`, `iiot.yml`) | `4` / `6` vCPU | `12 GB` / `16 GB` | `25 GB` SSD | Companion `api` (`512m`), `keycloak` (`1024m`), `gateway` (`512m`), `clamav` (`1536m`), `postgres` (`512m`), `nocobase-db` (`768m`), `redis` (`256m`), `nocobase` (`1536m`) |
| **Production Core (Zero-Trust)** | `infra/compose/prod.yml` (default services) | `8` / `16` vCPU | `16 GB` / `24 GB` | `60+ GB` NVMe | `caddy` (`256m`), `postgres` (`1536m`), `nocobase-db` (`2048m`), `redis` (`640m`), `rustfs` (`1024m`), `keycloak` (`1536m`), `clamav` (`2048m`), `file-scanner` (`256m`), `gateway` (`512m`), `orion-mongo` (`1024m`), `orion-ld` (`768m`), `nocobase` (`2048m`) — **13.4 GB** sum of container limits |
| **Production Full Suite (All Profiles)** | `prod.yml` + `--profile n8n`, `observability`, `iiot`, `pdf` | `12` / `16+` vCPU | `24 GB` / `32+ GB` | `100+ GB` NVMe | Adds `n8n` (`1024m`), `otel-collector` (`512m`), `prometheus` (`512m`), `grafana` (`512m`), `mosquitto` (`256m`), `nodered` (`512m`), `gotenberg` (`768m`) — **~17.3 GB** sum of container limits + PITR WAL `.gz` archive & RustFS objects |

::: warning ClamAV & Memory Allocation
`clamav/clamav:1.5.5` loads antivirus signature databases into memory on startup (`start_period: 120s`). In `prod.yml`, ClamAV is budgeted at `mem_limit: 2048m` (`1536m` in `core.yml`). Hosts running under `8 GB` RAM should use `pnpm native:clean` (`native-rehearsal.yml`) rather than booting the full ClamAV + Keycloak + Orion stack.
:::

## 4. Default Network Ports

All local development and clean-install stacks bind strictly to `127.0.0.1` so no unauthenticated lab port is exposed on public network interfaces. Only `caddy` in `infra/compose/prod.yml` binds external ports `80` and `443`.

| Port | Bind Scope | Service / Component | Compose / Source | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `80`, `443` (TCP & UDP) | Public (`prod.yml`) | **Caddy `2.10`** | `infra/compose/prod.yml` | TLS termination, HTTP/3 (`443/udp`), routes `LATTICE_DOMAIN`, `KEYCLOAK_DOMAIN`, `N8N_DOMAIN` |
| `13004`–`13999` | `127.0.0.1` | **Clean-Install NocoBase** | `scripts/native-clean-install.mjs` | Default `13004`; showcase convention `--port=13014` |
| `13000` | `127.0.0.1` | **NocoBase Dev Host** | `infra/compose/nocobase.yml` | Container port `80` mapped to `127.0.0.1:13000` |
| `13001` | `127.0.0.1` | **Native Rehearsal Host** | `infra/compose/native-rehearsal.yml` | Isolated upgrade rehearsal port |
| `8080` | `127.0.0.1` | **Apache APISIX `3.19.0`** | `infra/compose/core.yml` | Container port `9080`; internal-only in `prod.yml` behind Caddy |
| `8081` | `127.0.0.1` | **Keycloak `26.8.2`** | `infra/compose/core.yml` | Container port `8080`; exposed via Caddy `KEYCLOAK_DOMAIN` in `prod.yml` |
| `4000` | `127.0.0.1` | **`@dx/api` (Fastify)** | `.env.example` (`API_PORT`) | Local dev companion API (`pnpm dev`) |
| `4001` | `127.0.0.1` | **`@dx/agent-worker`** | `.env.example` (`WORKER_PORT`) | Local dev background worker (`pnpm dev`) |
| `4010` | Internal (`app`, `data`, `scanner`) | **`@dx/file-scanner`** | `infra/compose/prod.yml` | ClamAV + RustFS/local upload scanning service (`FILE_SCANNER_PORT`) |
| `1026` | `127.0.0.1` (`integration.yml`) / Internal (`prod.yml`) | **FIWARE Orion-LD `1.12.0`** | `integration.yml` / `prod.yml` | NGSI-LD Context Broker (never exposed externally in `prod.yml`) |
| `5678` | `127.0.0.1` (`integration.yml`) / Internal via Caddy (`prod.yml`) | **Stock n8n `2.48.1`** | `integration.yml` / `prod.yml` | Optional workflow automation (`--profile n8n`) |
| `1880` | `127.0.0.1` (`iiot.yml`) / Internal (`prod.yml`) | **Node-RED `4.0.9`** | `iiot.yml` / `prod.yml` | IIoT bridge & Digital Twin downlink (`--profile iiot`) |
| `1883` | Internal `iiot-net` only | **Eclipse Mosquitto `2.0.21`** | `iiot.yml` / `prod.yml` | Exposed solely inside `iiot-net` (`allow_anonymous false`, DynSec ACLs) |
| `2020` | Container internal | **Caddy Prometheus Metrics** | `infra/config/caddy/Caddyfile` | Internal scrape endpoint (`http://:2020/metrics`) |

## Next Steps

- [Quick Start & 1-Command Clean Install](/en/getting-started/quick-start) — Boot a clean `0.4.2` lab in one command with `pnpm native:clean`.
- [Zero-Trust Production Deployment](/en/getting-started/production-deployment) — Deploy the hardened multi-network `prod.yml` topology.
- [Environment & Runtime Configuration](/en/getting-started/configuration) — Configure required secrets, OIDC, IIoT, OCR/RAG, and RLS flags.
