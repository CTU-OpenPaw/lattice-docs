# Contributing to LatticeDX Docs (`CTU-OpenPaw/lattice-docs`)

Thank you for contributing to the **LatticeDX** bilingual documentation portal (`https://ctu-openpaw.github.io/lattice-docs/`), licensed under **Apache-2.0**.

Cảm ơn bạn đã đóng góp cho cổng tài liệu song ngữ **LatticeDX** (`https://ctu-openpaw.github.io/lattice-docs/`), phát hành theo giấy phép **Apache-2.0**.

---

## 1. Prerequisites / Yêu cầu môi trường

- **Node.js 24.x** (`>=24 <25`)
- **pnpm 10.23.0** (`corepack enable && corepack prepare pnpm@10.23.0 --activate`)
- **Git**

Install dependencies and run locally:

```sh
git clone https://github.com/CTU-OpenPaw/lattice-docs.git
cd lattice-docs
pnpm install --frozen-lockfile
```

### Local Development & Build Commands

| Command | Purpose |
| --- | --- |
| `pnpm docs:dev` | Start local VitePress dev server with hot reload (`/` VI and `/en/` EN) |
| `pnpm docs:build` | Build static site and verify **zero broken links** and valid Markdown/Mermaid syntax |
| `pnpm docs:preview` | Preview the built production static bundle locally |

---

## 2. Bilingual VI + EN Parity Requirement / Yêu cầu song ngữ VI + EN

`CTU-OpenPaw/lattice-docs` serves **100% bilingual documentation**:
- **Root `/`:** Vietnamese (Tiếng Việt)
- **Subpath `/en/`:** English

Every documentation contribution that adds, modifies, or removes a page, section, diagram, or API reference **MUST update both `/` (Vietnamese) and `/en/` (English)** in the same Pull Request to keep navigation, sidebars, tables, and technical specifications in full parity.

---

## 3. Strict `< 1.0.0` Version Lock (`0.4.2`)

This repository enforces a strict **`< 1.0.0` version lock** aligned with `CTU-OpenPaw/lattice-dx`:
- Current documentation target version is **`0.4.2`**.
- **NEVER** bump version numbers to major GA (`>= 1.0.0`) in package manifests, badges, URLs, or documentation text without explicit maintainer approval.

---

## 4. Pure-OSI & Zero-Invented-APIs Rule

### 4.1 Pure-OSI Compliance
- Use **only OSI-approved dependencies** (`VitePress`, `vitepress-plugin-mermaid`, `mermaid` under `MIT`). Do not introduce proprietary, BSL-1.1, or non-OSI packages or assets.
- Do not embed third-party copyrighted images, diagrams, or upstream NocoBase source code.
- Preserve **NocoBase `2.2.50` Clause 5.2** attribution (`Powered by NocoBase`, `https://www.nocobase.com`) wherever host runtime attribution is documented.
- **Zero secrets or tokens:** Never commit `.env` files, real API keys, `ldx_pat_*` tokens, private keys, or production credentials. Loopback test fixtures must be explicitly marked as local-only (`127.0.0.1` / `localhost`).

### 4.2 Zero-Invented-APIs Rule
- All documented endpoints, plugin names, BlockModels, LatticeFlow v2 nodes, AI tools, CLI scripts, Compose services, and verification counts **must match actual source code in `CTU-OpenPaw/lattice-dx` (`v0.4.2`)**.
- Do not invent unimplemented APIs, placeholder metrics, or speculative feature flags.

---

## 5. SPDX License Header Rule

Every authored source, configuration, script, and workflow file (`.ts`, `.mts`, `.js`, `.mjs`, `.yml`, `.yaml`) MUST include the CTU-OpenPaw SPDX header at the top of the file:

For `.ts` / `.mts` / `.mjs` / `.js` files:
```ts
/**
 * @file LatticeDX Documentation Portal
 * @author CTU-OpenPaw
 * @copyright (C) 2026 CTU-OpenPaw
 * @license Apache-2.0
 * @see https://github.com/CTU-OpenPaw/lattice-docs
 * SPDX-License-Identifier: Apache-2.0
 */
```

For `.yml` / `.yaml` files:
```yaml
# @file LatticeDX Documentation Portal
# @author CTU-OpenPaw
# @copyright (C) 2026 CTU-OpenPaw
# @license Apache-2.0
# @see https://github.com/CTU-OpenPaw/lattice-docs
# SPDX-License-Identifier: Apache-2.0
```

---

## 6. Pull Request Checklist

Before opening a Pull Request to `CTU-OpenPaw/lattice-docs`:
1. Both **Vietnamese (`/`)** and **English (`/en/`)** pages are updated with full content parity.
2. `pnpm docs:build` completes with **exit code 0** and **zero broken links**.
3. Strict **`< 1.0.0` version lock (`0.4.2`)** is preserved everywhere.
4. All `.ts` / `.mjs` / `.yml` files carry `SPDX-License-Identifier: Apache-2.0` headers.
5. Zero invented APIs, zero secrets/tokens, zero BSL-1.1 references, and NocoBase `2.2.50` Clause 5.2 attribution is intact.
