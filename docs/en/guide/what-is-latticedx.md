# What is LatticeDX (`v0.4.2`)?

**LatticeDX `v0.4.2`** (*DX-OS Open-Core Championship Edition*) is an **Apache-2.0 Open-Core Enterprise Operating Platform & Agentic App Builder** developed by **CTU-OpenPaw** for **OLP PMNM 2026 (VFOSSA)** and production enterprise operations.

Instead of treating low-code forms, workflow automation, IIoT telemetry, knowledge management, and AI agents as disconnected tools, LatticeDX unifies **Human (`[H]`) – Process (`[P]`) – Data (`[D]`) – Intelligence (`[I]`)** across **6 coordinated DX-OS planes** on top of a multi-tenant PostgreSQL 16 `FORCE ROW LEVEL SECURITY` foundation.

> **Version Lock (`< 1.0.0`):** LatticeDX is intentionally maintained on the `0.4.x` release line (`0.4.2`). All manifests, plugins, SBOM artifacts, and release tarballs remain strictly `< 1.0.0` until a formal maintainer sign-off.

---

## Open-Core DX-OS Philosophy

Enterprise digitization typically fails in one of two ways: rigid monolithic ERPs that cannot adapt to operational workflows, or fragmented SaaS/no-code point tools that duplicate identity, leak tenant data, and lock organizations into proprietary or `BSL-1.1` licenses.

LatticeDX solves this with four architectural principles:

1. **Pure-OSI First-Party Core (`Apache-2.0`):**
   100% of the `CTU-OpenPaw/lattice-dx` Git repository and `latticedx-0.4.2-src.tar.gz` release archive contains strictly OSI-approved code (`1,098` first-party files carrying `@copyright (C) 2026 CTU-OpenPaw` + `SPDX-License-Identifier: Apache-2.0`, zero `BSL-1.1`, zero `upstream/nocobase` submodule, and zero `.gitmodules`).
2. **Host-Runtime Isolation (`sdkProvidedByHost: true`):**
   NocoBase `2.2.50` runs strictly as an external OCI container at runtime (`nocobase/nocobase:2.2.50`) as **Plane #6 (`appDataSubstrate`)**. All 7 `@latticedx/*` plugins bind at runtime via `"sdkProvidedByHost": true` and preserve NocoBase Clause 5.2 attribution (`Powered by NocoBase`, `v2.2.50`, `https://www.nocobase.com`, `License settings`).
3. **Fail-Closed Zero-Trust & Multi-Tenancy:**
   Tenant isolation is enforced inside PostgreSQL 16 itself—not merely in UI filters. The non-superuser `nocobase_app` role executes inside `AsyncLocalStorage` transactions setting `app.current_org` across **56 static `FORCE RLS` tables** plus dynamically generated `latticeCustom*` tables and `belongsToMany` join tables.
4. **Governed Human–Agent Co-Execution (`[H]–[P]–[D]–[I]`):**
   AI agents are not bolted onto the side as unauthenticated chatbots. They run with explicit RBAC role locks, 20 scoped tools, PostgreSQL-backed quota policies, Vietnamese PII redaction, Human-in-the-Loop (HITL) approval queues, OpenTelemetry GenAI tracing (`latticeAiTraces`), and bidirectional MCP / Google-LF A2A protocols.

---

## The Four DX-OS Pillars (`H–P–D–I`)

| Pillar | Operational Scope | Key Implemented Capabilities (`v0.4.2`) |
| --- | --- | --- |
| **`[H]` Human & Knowledge** | Role-scoped workspaces, field mobility, public intake, and institutional memory | 7 `ldx_*` roles, Multi-Portal `/p/*`, Mobile Field PWA (`/v/mobile`), zero-PII Public Forms (`/v/form/:slug`), Unified Approval Inbox (`M-of-N` + delegations), Omnichannel Notify, P.A.R.A. Knowledge Vault (`/admin/settings/dxos-para`), OCR Form Autofill, Record Chatter & `Ctrl+K` Command Palette |
| **`[P]` Process & Poka-yoke** | Error-proofed business execution, visual rules, and orchestration | 4 Poka-yoke workflows, Visual Interactive DMN (`FIRST`/`UNIQUE`/`COLLECT`/`PRIORITY`), LatticeFlow v2 DAG Studio (24 node types, Draft/Publish, HITL Loop Cursor resume), OMS/WMS/FEFO (`FOR UPDATE` locking) + ePOD + Ed25519 QR tracking (`/v/track/:code`), Stock `n8n` `2.48.1` REST v1 bridge, Rich Schema Domain Builder & Business Packs |
| **`[D]` Data & IT/OT Twin** | Tenant-isolated persistence, governance, lineage, and real-time telemetry | 56 static PG16 `FORCE RLS` tables + dynamic `latticeCustom*`, `pgvector 0.8.1` HNSW + RRF Hybrid RAG, CloudEvents 1.0 + Standard Webhooks (`dxosEvents`), AES-256-GCM Connector Vault (`dxosVault`), Ed25519 + Merkle PKI Ledger (`dxosLedger`), Arrhenius MKT & Quarantine, Eclipse Mosquitto `2.0.21` DynSec/LWT, Node-RED `4.0.9`, FIWARE Orion-LD `1.12.0` 2-Way Digital Twin |
| **`[I]` Intelligence & Builders** | Autonomous triage, conversational operations, and governed app generation | 7 Starter AI Profiles, 20 Unified AI Tools, App Builder 2.0 (`plan`/`build`/`patch`/`rollback`/`verify` + Visual ER + GitOps Solution Bundle v3), Proactive LLM Triage, 2-Way Streamable MCP (`/api/dxos-mcp`, `/api/dxos-mcp/it-ot`), A2A (`/.well-known/agent-card.json`, `/api/dxos-a2a`), OTel GenAI Trace Waterfall & Eval Lab (`163/163` Vietnamese NL eval) |

---

## Platform Comparison Matrix

| Dimension | LatticeDX `v0.4.2` (Open-Core DX-OS) | Raw NocoBase Host (`2.2.50`) | Proprietary / `BSL-1.1` Low-Code & IIoT Stacks |
| --- | --- | --- | --- |
| **Core Repository License** | **100% Pure-OSI `Apache-2.0`** (`0` `BSL-1.1`, `257/257` SBOM resolved) | Apache-2.0 + Clauses 4.2 & 5.1–5.4 / AGPL-3.0 & Commercial headers | Proprietary or `BSL-1.1` (restricted commercial/SaaS redistribution) |
| **Multi-Tenant DB Isolation** | **56 static + dynamic `FORCE RLS`** via non-superuser `nocobase_app` + `AsyncLocalStorage` | Application-level ACL / schema conventions | Often app-layer filtering only or paid enterprise tier |
| **IIoT & Digital Twin Stack** | **Pure-OSI**: Mosquitto `2.0.21` DynSec + Node-RED `4.0.9` + PG16 `latticeTelemetryPoints` + Orion-LD `1.12.0` | Not included natively | Frequently requires `BSL-1.1` ThingsBoard / EMQX or proprietary cloud IoT |
| **Cache & Edge Gateway** | **Pure-OSI**: `Valkey 8.1` (`BSD-3-Clause`) + `Caddy 2.10` + `Apache APISIX 3.19.0` + `Keycloak 26.8.2` | Basic auth / external reverse proxy | Often Redis `RSALv2`/`SSPLv1` or vendor-locked gateway |
| **Workflow & Decisioning** | **24-node LatticeFlow v2 DAG** (Draft/Publish, ReAct `ai.agent`, HITL) + **Visual DMN** + optional `n8n` REST v1 | Standard NocoBase workflow nodes | Separate workflow tool without unified RLS, DMN, or PKI ledger |
| **Agentic App Builder & Standards** | **App Builder 2.0** (Plan/Diff/Patch/Rollback + 2-round verifier), **2-Way MCP**, **A2A**, **OTel GenAI** | Manual UI/collection configuration | Prompt-to-code prototypes without RLS, RBAC, or rollback governance |
| **Offline Mobility & Public Trust** | **Mobile PWA (`/v/mobile`)** with IndexedDB outbox + **zero-PII `/v/track/:code` Ed25519** + **`/v/form/:slug`** | Responsive web views | Separate mobile app or unverified public links |

---

## Included Plug-and-Play Domain Applications

LatticeDX ships with ready-to-run domain portals and 1-click Business Packs built from the same underlying plugins and contracts:

- **Logistics, OMS/WMS/FEFO & ePOD (`/p/logistics`, `/v/track/:code`, `/v/mobile`):** `FOR UPDATE` transactional FEFO stock allocation, Arrhenius MKT lot quarantine/release, driver ePOD capture with GPS + signature + raster evidence photo, and ISO/IEC 18004 QR public verification via Ed25519 signatures.
- **IIoT & Cold-Chain Incidents (`/p/incidents`):** Live WebGIS (`maplibre-gl@6.19.0`), Mosquitto DynSec device lifecycle, 2-way Digital Twin shadow (`desired`/`reported`), quarantine & deduplicated alarm triage.
- **Procurement & Internal Services (`/p/procurement`, `/p/services`):** Poka-yoke maker-checker workflows, immutable voucher lifecycle (`Submit`/`Cancel`/`Amend`), SLA escalation, and multi-level `M-of-N` approvals.
- **CMMS Maintenance & Partner Claims (`/p/cmms`, `/p/partner-claims`):** 1-click domain packs provisioned with `hasOne`/`belongsToMany` Rich Schema relations, AST formulas, and `FORCE RLS` join tables.

## Where to Go Next

- [6-Plane Architecture & Interaction Patterns](/en/guide/architecture)
- [7-Plugin Modularity (`sdkProvidedByHost`)](/en/guide/plugins-modularity)
- [Tech Stack & Pure-OSI Boundary](/en/guide/tech-stack-and-osi)
- [Quick Start (`pnpm native:clean`)](/en/getting-started/quick-start)
