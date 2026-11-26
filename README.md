# LatticeDX Documentation Portal (`v0.4.2`)

> **Bilingual Official Documentation (Tiếng Việt & English)** for **[LatticeDX](https://github.com/CTU-OpenPaw/lattice-dx)** — Open Digital Enterprise Platform (`DX-OS Open-Core`, `Apache-2.0` Pure-OSI) by **CTU-OpenPaw**.

[![Docs Portal (VI)](https://img.shields.io/badge/Docs_Portal-Ti%E1%BA%BFng_Vi%E1%BB%87t-FF6B35?style=flat-square)](https://ctu-openpaw.github.io/lattice-docs/)
[![Docs Portal (EN)](https://img.shields.io/badge/Docs_Portal-English-0F766E?style=flat-square)](https://ctu-openpaw.github.io/lattice-docs/en/)
[![Version](https://img.shields.io/badge/Version-0.4.2-2563EB?style=flat-square)](https://github.com/CTU-OpenPaw/lattice-dx)
[![License](https://img.shields.io/badge/License-Apache--2.0_Pure--OSI-16A34A?style=flat-square)](LICENSE)
[![Powered by VitePress](https://img.shields.io/badge/Built_with-VitePress_(MIT)-646CFF?style=flat-square)](https://vitepress.dev/)

---

## Live Documentation Portals / Cổng tài liệu trực tuyến

- **Tiếng Việt (Root `/`):** https://ctu-openpaw.github.io/lattice-docs/
- **English (`/en/`):** https://ctu-openpaw.github.io/lattice-docs/en/

---

## Documentation Content Map / Bản đồ nội dung 6 miền

| # | Domain / Miền nội dung | Tiếng Việt (`/`) | English (`/en/`) | Key Coverage (`v0.4.2`) |
| --- | --- | --- | --- | --- |
| 1 | **Overview & Architecture** | [`/guide/what-is-latticedx`](https://ctu-openpaw.github.io/lattice-docs/guide/what-is-latticedx) | [`/en/guide/what-is-latticedx`](https://ctu-openpaw.github.io/lattice-docs/en/guide/what-is-latticedx) | 6-Plane DX-OS Architecture, 7 Apache-2.0 Plugins (`sdkProvidedByHost: true`), Tech Stack, Pure-OSI Boundary |
| 2 | **Getting Started** | [`/getting-started/requirements`](https://ctu-openpaw.github.io/lattice-docs/getting-started/requirements) | [`/en/getting-started/requirements`](https://ctu-openpaw.github.io/lattice-docs/en/getting-started/requirements) | `Node 24.x`, `pnpm 10.23.0`, `pnpm native:clean`, Blank-Slate vs Demo Seed, Zero-Trust Prod (`prod.yml`, Caddy, APISIX, Keycloak, Valkey 8.1, PG16) |
| 3 | **Core Modules & Features** | [`/modules/multi-portal-blocks`](https://ctu-openpaw.github.io/lattice-docs/modules/multi-portal-blocks) | [`/en/modules/multi-portal-blocks`](https://ctu-openpaw.github.io/lattice-docs/en/modules/multi-portal-blocks) | 12 Native v2 BlockModels, OMS/WMS/FEFO/ePOD & Ed25519 QR, LatticeFlow v2 (24 Nodes), Visual DMN, DX-OS AI Studio (20 Tools, 7 Profiles, MCP, A2A, Eval 163/163), P.A.R.A. OCR/RAG, Approvals, Notify, Public Forms, Mobile PWA, IIoT & 2-Way Digital Twin, Stock `n8n` |
| 4 | **API, Security & Multi-Tenant** | [`/security/multi-tenant-rls`](https://ctu-openpaw.github.io/lattice-docs/security/multi-tenant-rls) | [`/en/security/multi-tenant-rls`](https://ctu-openpaw.github.io/lattice-docs/en/security/multi-tenant-rls) | 56-Table PG16 `FORCE RLS` (`nocobase_app`), Scoped `ldx_pat_*` Keys, Ed25519 + Merkle PKI Ledger, SSRF/XSS/Prompt-Injection Defenses, OpenAPI 3.1 & AsyncAPI 3.0, OIDC/PKCE |
| 5 | **Operations, Testing & DR** | [`/operations/observability`](https://ctu-openpaw.github.io/lattice-docs/operations/observability) | [`/en/operations/observability`](https://ctu-openpaw.github.io/lattice-docs/en/operations/observability) | OTel GenAI, Prometheus & Grafana 360°, Stack Snapshot & PITR WAL `.gz` Recovery, Complete E2E Testing Guide, Demo Pack & 15-Min Finals Script |
| 6 | **OSS Governance & PoF** | [`/oss/pure-osi-policy`](https://ctu-openpaw.github.io/lattice-docs/oss/pure-osi-policy) | [`/en/oss/pure-osi-policy`](https://ctu-openpaw.github.io/lattice-docs/en/oss/pure-osi-policy) | Pure-OSI Apache-2.0 Policy (0 BSL-1.1), NocoBase `2.2.50` Clause 5.2 Attribution, CycloneDX 1.5 SBOM (`257/257`), Build-from-Source, `< 1.0.0` Versioning Policy |

---

## Local Development & Build / Chạy và build cục bộ

### Prerequisites / Yêu cầu
- **Node.js 24.x** (`>=24 <25`)
- **pnpm 10.23.0**

### Commands / Lệnh thực thi

```sh
git clone https://github.com/CTU-OpenPaw/lattice-docs.git
cd lattice-docs
pnpm install --frozen-lockfile

# Start bilingual VitePress dev server (VI at / and EN at /en/)
pnpm docs:dev

# Build static site and verify zero broken links
pnpm docs:build

# Preview built output locally
pnpm docs:preview
```

---

## CTU-OpenPaw Ecosystem / Hệ sinh thái CTU-OpenPaw

| Repository | Role / Vai trò | Link |
| --- | --- | --- |
| **CTU-OpenPaw/lattice-dx** | Core Open-Source Digital Enterprise Platform (`v0.4.2`, Pure-OSI `Apache-2.0`) | https://github.com/CTU-OpenPaw/lattice-dx |
| **CTU-OpenPaw/lattice-docs** | Bilingual Documentation Portal (VitePress `MIT`, Content `Apache-2.0`) | https://github.com/CTU-OpenPaw/lattice-docs |
| **CTU-OpenPaw/lattice-templates** | Sanitized LatticeFlow v2, DMN, n8n, Business Packs & Solution Bundles (`Apache-2.0`) | https://github.com/CTU-OpenPaw/lattice-templates |
| **CTU-OpenPaw** | Organization Profile, Community Standards & Governance | https://github.com/CTU-OpenPaw |

---

## Pure-OSI License & NocoBase Clause 5.2 Attribution

- **Documentation & Assets:** Licensed under **Apache License 2.0** (`LICENSE`, `NOTICE`, `COPYRIGHT.txt`).
- **Site Tooling:** Built with Pure-OSI **MIT** tooling (`VitePress`, `vitepress-plugin-mermaid`, `mermaid`).
- **Version Lock:** Strictly **`0.4.2`** (`< 1.0.0`).
- **NocoBase Clause 5.2 Attribution:** LatticeDX targets the external NocoBase host runtime (`nocobase/nocobase:2.2.50`, `sdkProvidedByHost: true`) with zero upstream source code embedded in Git, and preserves **Powered by NocoBase** (`v2.2.50`, `https://www.nocobase.com`) attribution in accordance with NocoBase License Agreement Clause 5.2.
