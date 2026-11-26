# Pull Request — CTU-OpenPaw/lattice-docs

## Summary / Tóm tắt thay đổi
- Describe what documentation pages, diagrams, or VitePress configuration were added or updated.
- Reference related issue(s) if applicable: `Closes #...`

## Mandatory Checklist / Danh sách kiểm tra bắt buộc

- [ ] **Bilingual Parity (VI + EN):** Both Vietnamese (`/`) and English (`/en/`) pages, sidebars, and links were updated in full parity.
- [ ] **Zero Broken Links (`pnpm docs:build`):** Ran `pnpm docs:build` locally and verified clean exit (`0`) with zero dead links or Mermaid syntax errors.
- [ ] **Strict `< 1.0.0` Version Lock (`0.4.2`):** Verified all version references stay strictly at `0.4.2` (`< 1.0.0`).
- [ ] **SPDX Headers:** Added `# SPDX-License-Identifier: Apache-2.0` / `@copyright (C) 2026 CTU-OpenPaw` headers to all new or modified `.ts`, `.mts`, `.mjs`, `.js`, and `.yml` files.
- [ ] **Pure-OSI & Accuracy Compliance:**
  - [ ] All APIs, CLI commands, plugin names, BlockModels, Flow nodes, AI tools, and metrics are verified directly against `CTU-OpenPaw/lattice-dx` (`0.4.2`) — zero invented APIs.
  - [ ] Zero secrets, real tokens, `.env` dumps, or PII included.
  - [ ] Pure-OSI dependencies only (no BSL-1.1 or unattributed third-party media) and NocoBase `2.2.50` Clause 5.2 attribution preserved where referenced.
