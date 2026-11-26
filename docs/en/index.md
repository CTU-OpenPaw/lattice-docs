---
layout: home

title: LatticeDX v0.4.2
titleTemplate: Pure-OSI Open Enterprise Operating Platform & Agentic App Builder

hero:
  name: LatticeDX v0.4.2
  text: Open-Core DX-OS
  tagline: Pure-OSI Open Enterprise Operating Platform & Agentic App Builder
  image:
    src: /images/openpaw-logo.png
    alt: CTU-OpenPaw LatticeDX Mascot
  actions:
    - theme: brand
      text: What is LatticeDX?
      link: /en/guide/what-is-latticedx
    - theme: alt
      text: Quick Start
      link: /en/getting-started/quick-start
    - theme: alt
      text: GitHub
      link: https://github.com/CTU-OpenPaw/lattice-dx

features:
  - icon: "\U0001F3DB\uFE0F"
    title: 6-Plane DX-OS & 7 Apache-2.0 Plugins
    details: Built on NocoBase 2.2.50 external OCI host runtime with 7 isolated Apache-2.0 plugins (sdkProvidedByHost=true) unifying Human [H], Process [P], Data [D], and Intelligence [I].
    link: /en/guide/plugins-modularity
  - icon: "\U0001F5FA\uFE0F"
    title: Multi-Portal, Mobile PWA & 12 BlockModels
    details: Role-scoped portals (/p/*), offline-capable Mobile Field PWA (/v/mobile) with IndexedDB outbox, zero-PII Public Forms (/v/form/:slug), WebGIS, Kanban, WMS Ops, and BI Charts.
    link: /en/modules/multi-portal-blocks
  - icon: "\u26A1"
    title: LatticeFlow v2 DAG, Visual DMN & Stock n8n
    details: 24-node DAG studio with Draft/Publish versioning, multi-turn ReAct ai.agent, HITL Loop Cursor resume, Visual DMN hit policies, and bidirectional Stock n8n 2.48.1 REST v1.
    link: /en/modules/latticeflow-v2
  - icon: "\U0001F916"
    title: AI Workforce, App Builder 2.0, MCP & A2A
    details: 7 starter AI profiles, 20 unified tools (plan/build/patch/rollback/verify multi-entity apps), Google/LF A2A protocol, 2-way Streamable MCP, OTel GenAI traces, and 163/163 NL eval.
    link: /en/modules/ai-studio-app-builder
  - icon: "\U0001F4DA"
    title: P.A.R.A. Knowledge Vault & Hybrid RAG
    details: Extract PDF (Vietnamese ToUnicode CMap), DOCX, XLSX, and PPTX with OCR Form Autofill, strict 7-role ACL, and pgvector 0.8.1 HNSW + tsvector RRF hybrid search.
    link: /en/modules/para-knowledge-ocr
  - icon: "\U0001F4E1"
    title: IIoT Mosquitto DynSec & 2-Way Digital Twin
    details: Pure-OSI Eclipse Mosquitto 2.0.21 Dynamic Security + LWT, Node-RED 4.0.9 downlink, FIWARE Orion-LD 1.12.0 2-way subscriptions, and Arrhenius Mean Kinetic Temperature (MKT).
    link: /en/modules/iiot-digital-twin-n8n
  - icon: "\U0001F510"
    title: 56-Table PG16 FORCE RLS & Ed25519 PKI
    details: Non-superuser nocobase_app role with AsyncLocalStorage tenant isolation across 56 static tables + dynamic latticeCustom* tables, scoped ldx_pat_* keys, and Merkle PKI ledger.
    link: /en/security/multi-tenant-rls
  - icon: "\u2705"
    title: Pure-OSI Apache-2.0 & 257/257 SBOM
    details: Zero BSL-1.1, zero ThingsBoard or EMQX, zero upstream submodules or .gitmodules, Clause 5.2 NocoBase attribution preserved, and full CycloneDX 1.5 SBOM verification.
    link: /en/oss/pure-osi-policy
---

## Target Platform Architecture (`v0.4.2`)

LatticeDX `v0.4.2` organizes enterprise operations across **6 coordinated DX-OS planes**, separating user-facing portals and configuration studios from headless shared services, service-owned PostgreSQL `FORCE RLS` persistence, and strict container network boundaries.

![LatticeDX v0.4.2 Target Platform Architecture](/images/architecture-en.webp)

Explore the full architectural breakdown, Zero-Trust data flow, and the 5 Platform Interaction Patterns in the [Architecture Guide](/en/guide/architecture).

---

## Verified Quality, Security & Open-Source Metrics (`v0.4.2`)

All counts below are directly verified against `CTU-OpenPaw/lattice-dx` (`v0.4.2`) via automated test suites, compliance audits, and deterministic SBOM checks:

| Verification Dimension | Verified Result | Verification Scope & Tooling | Reference |
| --- | :---: | --- | --- |
| **Unit & Integration Tests** | **`2,509 / 2,509`** | `1,128` Vitest (`152` files) + `1,381` `node --test` (`174` files across 7 plugins & scripts) | [Testing & E2E Guide](/en/operations/testing-e2e-guide) |
| **End-to-End (E2E) Coverage** | **`124 / 124`** | 8 operational domains across 5 roles (`root`, `ldx_manager`, `ldx_employee`, `ldx_dispatcher`, `ldx_driver`) | [Testing & E2E Guide](/en/operations/testing-e2e-guide) |
| **Vietnamese NL Agent Eval** | **`163 / 163` (`100%`)** | 23 intent & security categories including 30 `security-refusal` cases (`eval-vietnamese-nl-agent.mjs`) | [AI Studio & App Builder](/en/modules/ai-studio-app-builder) |
| **CycloneDX 1.5 SBOM** | **`257 / 257`** | `12` workspace + `226` npm + `19` `@sha256:` pinned OCI images (`0` `NONE`, `0` `BSL-1.1`) | [SBOM & Build from Source](/en/oss/sbom-and-build-from-source) |
| **Multi-Tenant `FORCE RLS`** | **`56` static tables** | `54` camelCase + `2` snake-case tables (`nocobase_app` non-superuser) + dynamic `latticeCustom*` | [Multi-Tenant RLS](/en/security/multi-tenant-rls) |
| **SPDX Apache-2.0 Headers** | **`1,098` files** | `100%` first-party source files carrying `@copyright (C) 2026 CTU-OpenPaw` & SPDX header | [Pure-OSI Policy](/en/oss/pure-osi-policy) |
| **PoF Readiness & Prod Audit** | **`6 / 6` PASS · `0` CVEs** | `pnpm pof:check` (`6/6`) and `pnpm audit --prod --audit-level=low` (`0` vulnerabilities) | [Tech Stack & Pure-OSI](/en/guide/tech-stack-and-osi) |

---

## CTU-OpenPaw Open-Source Ecosystem

LatticeDX is maintained as a modular 4-repository Pure-OSI ecosystem under **CTU-OpenPaw**:

| Repository | Role | License | Links |
| --- | --- | :---: | --- |
| **`CTU-OpenPaw/lattice-dx`** | Core DX-OS platform, 7 NocoBase plugins (`0.4.2`), companion `@dx/*` services, Compose stacks & test suites | `Apache-2.0` | [GitHub](https://github.com/CTU-OpenPaw/lattice-dx) |
| **`CTU-OpenPaw/lattice-docs`** | Bilingual VitePress documentation portal (Vietnamese `/` & English `/en/`) deployed via GitHub Pages | `Apache-2.0` / `MIT` docs stack | [Docs Home](/en/guide/what-is-latticedx) |
| **`CTU-OpenPaw/lattice-templates`** | Curated sanitized LatticeFlow v2 blueprints, `n8n` workflows, DMN tables, Business Packs, Public Forms & Solution Bundles | `Apache-2.0` | [GitHub](https://github.com/CTU-OpenPaw/lattice-templates) |
| **`CTU-OpenPaw/.github`** | Organization profile, community health governance, Code of Conduct & security contact | `Apache-2.0` | [GitHub](https://github.com/CTU-OpenPaw/.github) |

## Next Steps

- **Understand the Platform:** Read [What is LatticeDX?](/en/guide/what-is-latticedx) and the [6-Plane Architecture](/en/guide/architecture).
- **Inspect Modularity & Licensing:** Review the [7-Plugin Modularity](/en/guide/plugins-modularity) and [Tech Stack & Pure-OSI Boundary](/en/guide/tech-stack-and-osi).
- **Run Locally:** Follow [Requirements](/en/getting-started/requirements) and [Quick Start](/en/getting-started/quick-start) to boot a clean-install `v0.4.2` environment.
