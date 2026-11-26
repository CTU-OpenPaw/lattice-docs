---
title: Installation Profiles & Compose Stacks
description: Reference for all 8 Docker Compose files, 5 production profiles in prod.yml, 5 isolated networks, 18 persistent volumes, and hardware sizing in LatticeDX 0.4.2.
---

# Installation Profiles & Compose Stacks

LatticeDX (`0.4.2`) organizes container infrastructure under `infra/compose/*.yml` into composable stacks for local development, isolated upgrade rehearsals, and Zero-Trust production deployments. Every image reference is pinned to an immutable `@sha256` digest and enforces `security_opt: [no-new-privileges:true]`.

## Compose Files Inventory

| File | Project `name` | Included Services | Primary Purpose |
| :--- | :--- | :--- | :--- |
| `infra/compose/core.yml` | `lattice-dx` | `postgres`, `keycloak`, `api`, `gateway`, `clamav` | Local Fastify companion API, Keycloak OIDC dev realm, and Apache APISIX bound to `127.0.0.1:8080`. |
| `infra/compose/nocobase.yml` | `lattice-dx` | `nocobase-db`, `redis`, `nocobase` | `nocobase/nocobase:2.2.50` host mounting 7 plugins `:ro`, `pgvector 0.8.1`, and `Valkey 8.1` on `127.0.0.1:13000`. |
| `infra/compose/iiot.yml` | `lattice-dx` | `mosquitto`, `nodered` | Isolated IIoT edge stack on `iiot-net` (`Eclipse Mosquitto 2.0.21` DynSec + `Node-RED 4.0.9`). |
| `infra/compose/integration.yml` | `lattice-dx` | `orion-mongo`, `orion-ld`, `n8n` | NGSI-LD Context Broker (`FIWARE Orion-LD 1.12.0`) and `n8n 2.48.1` workflow runtime. |
| `infra/compose/native-files.yml` | *(overlay)* | Env overlay for `api` and `nocobase` | Enables `api:4000` + `clamav` attachment scanning when combining `core.yml` and `nocobase.yml`. |
| `infra/compose/native-rehearsal.yml` | `lattice-native-rehearsal` | `nocobase-db`, `nocobase` | Isolated upgrade rehearsal and `pnpm native:clean` lab bound to `127.0.0.1:13001` (or `13004..13999`). |
| `infra/compose/uc1-sample.yml` | *(overlay)* | `uc1-sample`, `uc1-broker-worker` | External application bridge sample service on `127.0.0.1:4100`. |
| `infra/compose/prod.yml` | `lattice-dx-prod` | `12` default services + `8` profiled services | Hardened Zero-Trust production stack with `Caddy 2.10`, `RustFS 1.0.6`, PITR WAL archiving, and `cap_drop: [ALL]`. |

## Production Profiles (`infra/compose/prod.yml`)

The production stack launches `12` core services by default and gates optional workloads behind `5` opt-in Compose profiles:

<ParamGrid
  title="Opt-In Profiles in infra/compose/prod.yml"
  :items="[
    { name: 'iam-sync', type: 'oneshot', default: 'keycloak-config-cli', description: 'Imports and reconciles the production Keycloak realm (lattice-realm.prod.json) and exits cleanly (restart: no).' },
    { name: 'n8n', type: 'service', default: 'n8n (2.48.1)', description: 'Runs n8n backed by the dedicated n8n_app PostgreSQL 16 role and exposed via Caddy N8N_DOMAIN.' },
    { name: 'observability', type: '3 services', default: 'otel-collector, prometheus, grafana', description: 'Collects OTLP traces (:4317/:4318), runs Prometheus v3.3.0 (15d retention), and serves Grafana 11.5.8 dashboards.' },
    { name: 'pdf', type: 'service', default: 'gotenberg (8.20.1)', description: 'Renders Unicode HTML-to-PDF vouchers on a read-only filesystem with --chromium-disable-javascript=true.' },
    { name: 'iiot', type: '2 services', default: 'mosquitto, nodered', description: 'Starts the Dynamic-Security MQTT broker on iiot-net alongside Node-RED with AES-256-CTR encrypted credentials.' }
  ]"
/>

<CodeTabs
  :tabs="[
    {
      label: 'Core Production (12 Services)',
      lang: 'bash',
      code: 'docker compose --env-file .env.prod -f infra/compose/prod.yml up -d'
    },
    {
      label: 'Initial Keycloak Realm Sync',
      lang: 'bash',
      code: 'docker compose --env-file .env.prod -f infra/compose/prod.yml --profile iam-sync run --rm keycloak-config-cli'
    },
    {
      label: 'Core + Observability & PDF',
      lang: 'bash',
      code: 'docker compose --env-file .env.prod -f infra/compose/prod.yml \\\n  --profile observability --profile pdf up -d'
    },
    {
      label: 'Full Enterprise Suite (All Profiles)',
      lang: 'bash',
      code: 'docker compose --env-file .env.prod -f infra/compose/prod.yml \\\n  --profile n8n --profile observability --profile pdf --profile iiot up -d'
    }
  ]"
/>

## Default and Profiled Service Breakdown (`prod.yml`)

The table below lists the digest-pinned image tags, memory/CPU limits, network attachments, and healthcheck mechanisms for all `20` service definitions in `infra/compose/prod.yml`:

| Service | Profile | Image Tag | RAM / CPU | Networks | Healthcheck Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `caddy` | *(default)* | `caddy:2.10-alpine` | `256m` / `0.5` | `edge`, `app` | `http://127.0.0.1:2019/metrics` |
| `postgres` | *(default)* | `postgres:16.16-alpine` | `1536m` / `1.5` | `data` | `pg_isready -U "$POSTGRES_USER" -d postgres` |
| `nocobase-db` | *(default)* | `pgvector/pgvector:0.8.1-pg16` | `2048m` / `2.0` | `data` | `pg_isready -U "$POSTGRES_USER" -d nocobase` |
| `redis` | *(default)* | `valkey/valkey:8.1-alpine` | `640m` / `0.5` | `app`, `data` | `valkey-cli ping \| grep -q PONG` |
| `rustfs` | *(default)* | `rustfs/rustfs:1.0.6` | `1024m` / `1.0` | `data` | TCP `127.0.0.1:9000` |
| `keycloak` | *(default)* | `quay.io/keycloak/keycloak:26.8.2` | `1536m` / `1.5` | `edge`, `app`, `data` | `/health/ready` on port `9000` |
| `clamav` | *(default)* | `clamav/clamav:1.5.5` | `2048m` / `1.0` | `scanner` | `clamdcheck.sh` |
| `file-scanner` | *(default)* | `apps/file-scanner/Dockerfile` | `256m` / `0.5` | `app`, `data`, `scanner` | `http://127.0.0.1:4010/health` |
| `gateway` | *(default)* | `apache/apisix:3.19.0-debian` | `512m` / `1.0` | `edge`, `app` | `http://127.0.0.1:9080/health` |
| `orion-mongo` | *(default)* | `mongo:8.0` | `1024m` / `1.0` | `data` | `mongosh` SCRAM-authenticated ping |
| `orion-ld` | *(default)* | `fiware/orion-ld:1.12.0` | `768m` / `1.0` | `app`, `data` | `http://127.0.0.1:1026/version` |
| `nocobase` | *(default)* | `nocobase/nocobase:2.2.50` | `2048m` / `2.0` | `edge`, `app`, `data`, `iiot-net` | `http://127.0.0.1/api/app:getLang` |
| `keycloak-config-cli` | `iam-sync` | `adorsys/keycloak-config-cli:6.5.1-26` | `512m` | `app` | Oneshot task (`restart: "no"`) |
| `n8n` | `n8n` | `n8nio/n8n:2.48.1` | `1024m` / `1.0` | `app`, `data` | `http://127.0.0.1:5678/healthz` |
| `otel-collector` | `observability` | `otel/opentelemetry-collector-contrib:0.123.0` | `512m` / `0.5` | `app`, `data` | `/otelcol-contrib validate` |
| `prometheus` | `observability` | `prom/prometheus:v3.3.0` | `512m` / `0.5` | `app`, `data` | `http://127.0.0.1:9090/-/healthy` |
| `grafana` | `observability` | `grafana/grafana-oss:11.5.8` | `512m` / `0.5` | `app`, `data` | `http://127.0.0.1:3000/api/health` |
| `gotenberg` | `pdf` | `gotenberg/gotenberg:8.20.1` | `768m` / `1.0` | `app` | `http://127.0.0.1:3000/health` |
| `mosquitto` | `iiot` | `eclipse-mosquitto:2.0.21` | `256m` / `0.5` | `iiot-net` | `nc -z 127.0.0.1 1883` |
| `nodered` | `iiot` | `nodered/node-red:4.0.9` | `512m` / `0.5` | `iiot-net`, `app` | `http://127.0.0.1:1880/` |

## Five Segmented Production Networks

`infra/compose/prod.yml` defines `5` bridge networks. Four of them specify `internal: true` so databases, caches, virus scanners, and MQTT brokers have zero direct egress or ingress outside controlled gateway paths:

| Network | Isolation Mode | Attached Services | Security Boundary |
| :--- | :--- | :--- | :--- |
| `edge` | External bridge | `caddy`, `keycloak`, `gateway`, `nocobase` | Terminates TLS on ports `80/443` at Caddy and forwards traffic to APISIX, Keycloak, or NocoBase. |
| `app` | `internal: true` | `caddy`, `redis`, `keycloak`, `keycloak-config-cli`, `file-scanner`, `gateway`, `orion-ld`, `nocobase`, `n8n`, `otel-collector`, `prometheus`, `grafana`, `gotenberg`, `nodered` | Carries internal HTTP/OTLP traffic between gateways, host runtime, scanner, Orion-LD, and telemetry services. |
| `data` | `internal: true` | `postgres`, `nocobase-db`, `redis`, `rustfs`, `keycloak`, `file-scanner`, `orion-mongo`, `orion-ld`, `nocobase`, `n8n`, `otel-collector`, `prometheus`, `grafana` | Isolates PostgreSQL 16, Valkey 8.1, RustFS S3, and MongoDB 8.0 from the `edge` network. |
| `scanner` | `internal: true` | `clamav`, `file-scanner` | Restricts `clamd` (`:3310`) access exclusively to `@dx/file-scanner`. |
| `iiot-net` | `internal: true` | `nocobase`, `mosquitto`, `nodered` | Isolates MQTT `:1883` inside the edge telemetry bridge without exposing host ports. |

## Resource Limits & Hardware Sizing

Sizing allocations below aggregate the explicit `mem_limit` and `cpus` constraints defined across `infra/compose/*.yml`:

| Deployment Tier | Compose / Script Scope | Sum of Container Limits | Recommended Host Sizing (CPU / RAM / Disk) |
| :--- | :--- | :--- | :--- |
| **Isolated Clean Lab** | `native-rehearsal.yml` (`nocobase-db` + `nocobase`) | `2.0 GB` RAM | `2–4` vCPU, `4–8 GB` RAM, `10 GB` free |
| **Local Development Core** | `core.yml` + `nocobase.yml` | `6.66 GB` RAM | `4–6` vCPU, `12–16 GB` RAM, `25 GB` SSD |
| **Local Dev + Integration & IIoT** | `core.yml` + `nocobase.yml` + `integration.yml` + `iiot.yml` | `9.22 GB` RAM | `6–8` vCPU, `16 GB` RAM, `35 GB` SSD |
| **Production Core (Default)** | `prod.yml` (`12` default services) | `13.4 GB` RAM / `12.5+` CPU | `8–16` vCPU, `16–24 GB` RAM, `60+ GB` NVMe |
| **Production Full Suite (All Profiles)** | `prod.yml` + `n8n`, `observability`, `pdf`, `iiot` | `17.3 GB` RAM / `16+` CPU | `12–16+` vCPU, `24–32+ GB` RAM, `100+ GB` NVMe |

Operational note for `clamav/clamav:1.5.5`: the antivirus daemon loads signature databases into memory at startup (`start_period: 120s`, `mem_limit: 1536m` in `core.yml`, `2048m` in `prod.yml`). On workstations with less than `8 GB` RAM allocated to Docker, use `pnpm native:clean` (`native-rehearsal.yml`) rather than booting `core.yml` and `nocobase.yml` concurrently.

## Persistent Named Volumes (`prod.yml`)

| Subsystem | Volume Names | Stored State |
| :--- | :--- | :--- |
| **Edge Proxy** | `caddy-data`, `caddy-config` | ACME TLS certificates and Caddy runtime state. |
| **Core PostgreSQL & PITR** | `postgres-data`, `postgres-wal-archive` | `lattice`, `keycloak`, `n8n` databases and `.gz` WAL segments (`7`-day default retention). |
| **NocoBase DB & Storage** | `nocobase-db-data`, `nocobase-wal-archive`, `nocobase-storage` | `pgvector` database, NocoBase WAL archives, and local application uploads. |
| **Cache & Object Store** | `redis-data`, `rustfs-data`, `engine-objects` | Valkey 8.1 AOF persistence, RustFS S3 buckets, and temporary `file-scanner` objects. |
| **Antivirus & Context Broker** | `clamav-signatures`, `orion-mongo-data` | Updated ClamAV definitions and Orion-LD MongoDB 8.0 entity store. |
| **Profiled Extensions** | `n8n-data`, `prometheus-data`, `grafana-data`, `mosquitto-data`, `mosquitto-log`, `nodered-data` | `n8n` workflows/credentials, Prometheus TSDB (`15d` retention), Grafana state, Mosquitto DynSec DB, and Node-RED runtime data. |

## Port Matrix & Compose Validation

In local development stacks, only the ports listed below bind to `127.0.0.1` (`postgres`, `nocobase-db`, `redis`, `clamav`, `orion-mongo`, and `mosquitto` never publish host ports):

| Port | Local Dev Bind (`*.yml`) | Production Bind (`prod.yml`) | Target Service |
| :--- | :--- | :--- | :--- |
| `80`, `443` (TCP/UDP) | Unused | Public on `edge` | `caddy` (routes `LATTICE_DOMAIN`, `KEYCLOAK_DOMAIN`, `N8N_DOMAIN`) |
| `13000` / `13001` | `127.0.0.1` | Internal `:80` behind Caddy/APISIX | `nocobase` (`nocobase.yml` / `native-rehearsal.yml`) |
| `13004`–`13999` | `127.0.0.1` | Unused | `nocobase` spawned by `pnpm native:clean` |
| `8080` | `127.0.0.1` | Internal `:9080` on `edge`/`app` | `gateway` (Apache APISIX 3.19.0) |
| `8081` | `127.0.0.1` | Proxied via Caddy `KEYCLOAK_DOMAIN` | `keycloak` (Keycloak 26.8.2) |
| `1026` | `127.0.0.1` (`integration.yml`) | Internal `:1026` on `app`/`data` | `orion-ld` (FIWARE Orion-LD 1.12.0) |
| `5678` | `127.0.0.1` (`integration.yml`) | Proxied via Caddy `N8N_DOMAIN` (`--profile n8n`) | `n8n` (n8n 2.48.1) |
| `1880` | `127.0.0.1` (`iiot.yml`) | Internal `:1880` (`--profile iiot`) | `nodered` (Node-RED 4.0.9) |
| `1883` | Internal `iiot-net` | Internal `iiot-net` (`--profile iiot`) | `mosquitto` (Eclipse Mosquitto 2.0.21) |

Validate Compose syntax and inspect health statuses before maintenance or shutdown:

<CodeTabs
  :tabs="[
    {
      label: 'Validate Compose Syntax',
      lang: 'bash',
      code: 'docker compose --env-file .env.prod -f infra/compose/prod.yml \\\n  --profile n8n --profile observability --profile pdf --profile iiot config --quiet'
    },
    {
      label: 'Inspect Health Status',
      lang: 'bash',
      code: 'docker compose -f infra/compose/prod.yml ps'
    },
    {
      label: 'Stop All Profiles (Keep Volumes)',
      lang: 'bash',
      code: 'docker compose -f infra/compose/prod.yml \\\n  --profile n8n --profile observability --profile pdf --profile iiot down'
    }
  ]"
/>

## Related

- [Quickstart](/en/getting-started/quickstart) — Start an isolated lab with `pnpm native:clean` or the local dev stack with `pnpm local:up`.
- [Configuration](/en/getting-started/configuration) — Full environment variable catalog across all profiles in `prod.yml`.
- [Production Deployment](/en/getting-started/production-deployment) — Provisioning `nocobase_app`, rotating secrets, and enabling TLS termination.
- [Backup & PITR Recovery](/en/operations/backup-and-pitr) — Base backups, WAL archiving, and Point-in-Time Recovery procedures for PostgreSQL 16.
