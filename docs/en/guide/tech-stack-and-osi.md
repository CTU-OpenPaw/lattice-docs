# Tech Stack & Pure-OSI Boundary (`v0.4.2`)

LatticeDX `v0.4.2` is designed around a **Pure-OSI Open-Source Boundary**: **100% of the `CTU-OpenPaw/lattice-dx` Git repository and the `latticedx-0.4.2-src.tar.gz` release archive contains strictly OSI-approved code** (`Apache-2.0` first-party source + OSI-licensed npm dependencies), with **zero `BSL-1.1` software**, **zero `ThingsBoard` or `EMQX`**, and **zero `upstream/nocobase` submodules or `.gitmodules`**.

---

## Core Runtime & Workspace Toolchain

| Layer | Technology / Package | Version | License | Role in LatticeDX |
| --- | --- | :---: | :---: | --- |
| **Runtime** | Node.js | `>=24 <25` (`24.x`) | `MIT` | Server runtime for plugins, `@dx/*` services, CLI seeders, and `node --test` |
| **Package Manager** | pnpm | `10.23.0` | `MIT` | Workspace dependency resolution (`pnpm-lock.yaml`) and SBOM inventory |
| **Language & Tooling** | TypeScript / `tsx` / `@types/node` | `7.0.2` / `4.23.15` / `26.6.4` | `Apache-2.0` / `MIT` | Strict typechecking and TS service builds across `apps/*` & `packages/*` |
| **Companion API** | Fastify / `pg` / `jose` | `5.12.8` / `8.23.1` / `6.2.12` | `MIT` | Headless `/v1/*` REST API (`apps/api`) and NGSI-LD integration adapter |
| **Test Frameworks** | Vitest + `node:test` | `5.0.3` + Node 24 built-in | `MIT` | `1,128` Vitest tests (`152` files) + `1,381` Node tests (`174` files) = **`2,509` total** |
| **Frontend Host SDK** | React / Ant Design / NocoBase SDK | Host-provided (`2.2.50`) | Host runtime | Shared via `sdkProvidedByHost: true` across all 7 plugins |
| **DAG Canvas & Layout** | `@xyflow/react` + `@dagrejs/dagre` + `esbuild` | `12.12.1` + `3.1.3` + `0.28.2` | `MIT` | Build-time bundled into `plugin-dxos-studio` for LatticeFlow v2 |
| **WebGIS Mapping** | `maplibre-gl` + `esbuild` | `6.19.0` + `0.28.2` | `BSD-3-Clause` + `MIT` | Build-time bundled into `plugin-dxos-blocks` for `DxosWebGisBlockModel` (with offline WGS84 fallback) |
| **Enterprise OIDC** | `openid-client` / `jose` / `oauth4webapi` | `6.8.9` / `6.2.15` / `3.8.8` | `MIT` | Bundled into `plugin-enterprise-auth` via `package-lock.json` |

---

## Pure-OSI Replacement & Zero `BSL-1.1` Guarantee

During the progression from `v0.3.0` to `v0.4.2`, **CTU-OpenPaw** eliminated all Business Source License (`BSL-1.1`) and non-OSI risk vectors from the platform's data, cache, and IIoT layers:

- **Zero `BSL-1.1` / ThingsBoard / EMQX:** Neither ThingsBoard nor EMQX is used anywhere in source, lockfiles, or Docker Compose stacks. `scripts/generate-sbom.mjs` hard-fails on any package or container matching `BSL-1.1`, `thingsboard`, or `emqx`.
- **Valkey `8.1` (`BSD-3-Clause`) instead of proprietary/RSAL cache:** Powers OIDC session caching, rate limiting, and `PUBSUB_ADAPTER=redis` wire-compatible pub/sub across `nocobase.yml` and `prod.yml`.
- **Eclipse Mosquitto `2.0.21` (`EPL-2.0 OR BSD-3-Clause`) + Node-RED `4.0.9` (`Apache-2.0`):** Provides Dynamic Security (`allow_anonymous false`, `$CONTROL/dynamic-security/v1`), `BIRTH`/`DEATH` LWT monitoring, and 2-way Digital Twin downlink.
- **PostgreSQL `16` Native Time-Series (`latticeTelemetryPoints`):** IIoT telemetry points are stored directly in PostgreSQL `16` with `FORCE RLS`, eliminating any separate `timescaledb` container in `infra/compose/iiot.yml`.
- **Zero `upstream/nocobase` Submodule:** Both `upstream/nocobase` and `.gitmodules` were completely removed (`pnpm pof:check` verifies `upstream-clean`). NocoBase `2.2.50` is loaded strictly at runtime as an external OCI container while preserving Clause 5.2 UI attribution.

---

## All 19 Pinned `@sha256:` OCI Container Images

Every container service in `infra/compose/*.yml` is digest-pinned (`@sha256:`), synchronized 1-to-1 with `OCI_IMAGE_LICENSES` in `scripts/generate-sbom.mjs`, `NOTICE`, and `docs/sbom-cyclonedx.json`, and communicates across explicit container network boundaries (SQL, HTTP/REST, OIDC, NGSI-LD, MQTT, clamd TCP):

| Service | OCI Image & Exact `@sha256:` Digest | SPDX License | Boundary & Compose Files |
| --- | --- | :---: | --- |
| **PostgreSQL 16.16** | `postgres:16.16-alpine@sha256:f2f98726820d0342055351c6e9d36e705f5bfffb3dd53ff556325114b08afb6d` | `PostgreSQL` | Core DB (`core.yml`, `prod.yml`) |
| **pgvector 0.8.1 (PG16)** | `pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337` | `PostgreSQL` | Vector RAG + `FORCE RLS` + IIoT (`nocobase.yml`, `native-rehearsal.yml`, `prod.yml`) |
| **Valkey 8.1** | `valkey/valkey:8.1-alpine@sha256:9971099af41c36e887aabdfe22b80c0fe45df949163dfc9cb434febc57cfc3fc` | `BSD-3-Clause` | Pure-OSI Redis-compatible cache/pubsub (`nocobase.yml`, `prod.yml`) |
| **RustFS 1.0.6** | `rustfs/rustfs:1.0.6@sha256:ee717072290bec9b11abfc0365f8310b00df1cd9b3639943edae47bdef05044a` | `Apache-2.0` | S3-compatible object storage (`prod.yml`) |
| **Caddy 2.10** | `caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d` | `Apache-2.0` | TLS edge reverse proxy (`prod.yml`) |
| **Apache APISIX 3.19.0** | `apache/apisix:3.19.0-debian@sha256:9a7e45dc943fbf10ec916d1232bae4cda9302ae28a4696cfb83c2da01d261141` | `Apache-2.0` | API gateway, OIDC JWKS, rate limit (`core.yml`, `prod.yml`) |
| **Keycloak 26.8.2** | `quay.io/keycloak/keycloak:26.8.2@sha256:7e66a96e4739239070aeaf72e4c5decf0f7f682cfc725b9f7ea2b336eaba38b3` | `Apache-2.0` | OIDC + PKCE identity provider (`core.yml`, `prod.yml`) |
| **keycloak-config-cli** | `adorsys/keycloak-config-cli:6.5.1-26@sha256:1b22dfaa9ae0c71f74b0342f9221a6510f272da5def683dbba26a98e6b1b1411` | `Apache-2.0` | Declarative realm provisioning (`prod.yml`) |
| **NocoBase Host 2.2.50** | `nocobase/nocobase:2.2.50@sha256:04b75164936e7314ef74d82844bc56c9f34ed7ff1ca976ca53ffac2d3c88d777` | `NocoBase License Agreement (2026-02-24)` | External host runtime outside Git repo (`nocobase.yml`, `native-rehearsal.yml`, `prod.yml`) |
| **Eclipse Mosquitto 2.0.21** | `eclipse-mosquitto:2.0.21@sha256:94f5a3d7deafa59fa3440d227ddad558f59d293c612138de841eec61bfa4d353` | `EPL-2.0 OR BSD-3-Clause` | Pure-OSI IIoT MQTT broker (`iiot.yml`, `prod.yml`) |
| **Node-RED 4.0.9** | `nodered/node-red:4.0.9@sha256:0b295b3a14c512548567ca99db631bc37b23bfc79fd009ee8248a610fafdb4b5` | `Apache-2.0` | IIoT normalizer & Twin downlink (`iiot.yml`, `prod.yml`) |
| **OTel Collector 0.123.0** | `otel/opentelemetry-collector-contrib:0.123.0@sha256:e39311df1f3d941923c00da79ac7ba6269124a870ee87e3c3ad24d60f8aee4d2` | `Apache-2.0` | OTLP/HTTP trace ingestion (`prod.yml`) |
| **Prometheus v3.3.0** | `prom/prometheus:v3.3.0@sha256:339ce86a59413be18d0e445472891d022725b4803fab609069110205e79fb2f1` | `Apache-2.0` | Metrics scrape & alert rules (`prod.yml`) |
| **Gotenberg 8.20.1** | `gotenberg/gotenberg:8.20.1@sha256:cda4386c7ed38f18bc6897828be01ba7361c99929a5c84ec5e293d7916e29bac` | `MIT` | Optional PDF rendering container (`prod.yml`, `pdf` profile) |
| **ClamAV 1.5.5** | `clamav/clamav:1.5.5@sha256:12177441d1b40cef3c47b44c4090d59d4babc4c67bedd5af0fa315e603aa6dd8` | `GPL-2.0-only` | Standalone TCP `clamd` malware scanner (`core.yml`, `prod.yml`) |
| **FIWARE Orion-LD 1.12.0** | `fiware/orion-ld:1.12.0@sha256:f562a93ed84cccae05063688e1c3605f75060d0c7b9cd004561eec43bcbd613b` | `AGPL-3.0-only` | Standalone NGSI-LD context broker over HTTP (`integration.yml`, `prod.yml`) |
| **MongoDB 8.0** | `mongo:8.0@sha256:479e85ced54ffb8a40dade1dcde2da2a9ae858515b9415e9cc54bfb8f0575d01` | `SSPL-1.0` | Standalone DB container exclusively for Orion-LD (`integration.yml`, `prod.yml`) |
| **Grafana OSS 11.5.8** | `grafana/grafana-oss:11.5.8@sha256:b8121de93047fd77c77de806bae9706e7d60de21c3bd5381a5db0167f94c6a48` | `AGPL-3.0-only` | Standalone 360° observability UI (`prod.yml`, `observability` profile) |
| **n8n 2.48.1** | `n8nio/n8n:2.48.1@sha256:5e022f23ef9eaac3f51467e021610c218ed7eb5b41a05edb388ef1c8e00e009f` | `Sustainable Use License` | **Optional standalone external integration container** — never part of LatticeDX core automation engine (`integration.yml`, `prod.yml`) |

> **Container Boundary Principle:** External standalone containers such as `n8n` (Sustainable Use License), `Grafana OSS` / `Orion-LD` (`AGPL-3.0-only`), `ClamAV` (`GPL-2.0-only`), and `MongoDB` (`SSPL-1.0`) interact with LatticeDX strictly over standard network protocols (HTTP/REST, NGSI-LD, TCP `clamd`) and are never copied, statically linked, or relicensed as `Apache-2.0`.

---

## Automated License & SBOM Verification

LatticeDX enforces its Pure-OSI posture on every commit via CI (`.github/workflows/ci.yml`) and local audit scripts:

1. **CycloneDX 1.5 SBOM (`257/257` components):**
   `pnpm release:sbom -- --check` validates `docs/sbom-cyclonedx.json` covering `12` workspace entries, `226` npm packages (`fsevents@2.3.3 = MIT`), and `19` OCI images — with **`0` `NONE`** licenses and **`0` `BSL-1.1`** matches.
2. **Workspace npm License Snapshot (`153` grouped entries):**
   `pnpm licenses list --json` records `MIT` (`115`), `ISC` (`21`), `BSD-3-Clause` (`8`), `Apache-2.0` (`4`), `BSD-2-Clause` (`2`), `MPL-2.0` (`2` — `lightningcss` & `lightningcss-win32-x64-msvc`), and `(MIT OR Apache-2.0)` (`1` — `@maplibre/mlt`).
3. **SPDX Header & PoF Readiness (`6/6` PASS):**
   - `node scripts/source-headers.mjs --check` confirms **`1,098` first-party files** carry `@copyright (C) 2026 CTU-OpenPaw` and `SPDX-License-Identifier: Apache-2.0`.
   - `pnpm pof:check` verifies all 6 gates: `spdx-headers`, `governance-files`, `plugin-isolation`, `compose-digests`, `upstream-clean`, and `no-secrets`.
   - `pnpm audit --prod --audit-level=low` reports **`0` known production vulnerabilities**.

## Further Reading

- [Pure-OSI Open-Source Policy](/en/oss/pure-osi-policy)
- [NocoBase 2.2.50 Clause 5.2 Attribution](/en/oss/nocobase-clause-5-2)
- [CycloneDX SBOM & Build from Source](/en/oss/sbom-and-build-from-source)
- [Production Zero-Trust Deployment](/en/getting-started/production-deployment)
