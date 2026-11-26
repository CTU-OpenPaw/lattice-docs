# Đóng góp, Bảo mật, Chính sách Phiên bản `< 1.0.0` & Changelog

Trang này tổng hợp quy tắc quản trị dự án mã nguồn mở **LatticeDX** (`CTU-OpenPaw/lattice-dx`), bao gồm **chính sách khóa phiên bản `< 1.0.0` (`0.4.2`)**, quy trình đóng góp **Pull Request**, chính sách báo cáo lỗ hổng bảo mật và lịch sử phát hành từ `v0.2.0` đến `v0.4.2`.

---

## 1. Chính sách Phiên bản `< 1.0.0` (`0.4.2`)

::: info Khóa phiên bản nghiêm ngặt `< 1.0.0`
**LatticeDX** áp dụng chính sách khóa phiên bản tiền GA nghiêm ngặt **`< 1.0.0`**:
- Phiên bản hiện hành trên toàn bộ hệ sinh thái (**`CTU-OpenPaw/lattice-dx`**, **`CTU-OpenPaw/lattice-docs`**, **`CTU-OpenPaw/lattice-templates`**, 7 plugins `plugins/nocobase/*`, `docs/sbom-cyclonedx.json`, `COPYRIGHT.txt` và gói phát hành `latticedx-0.4.2-src.tar.gz`) được đồng bộ thống nhất ở **`0.4.2`**.
- Mọi bản vá và phát hành kế tiếp giữ ở chuỗi `0.4.x` / `0.x.y` (`< 1.0.0`) cho tới khi nhận được quyết định phê duyệt chính thức từ người duy trì dự án.
:::

---

## 2. Quy trình Đóng góp & Chuẩn Mã nguồn (`CONTRIBUTING.md`)

### Môi trường & Cài đặt

- **Node.js `24.x`** (`>=24 <25`), **pnpm `10.23.0`**, **Git**, **tar** và **Docker Compose v2+** (khi kiểm thử hạ tầng container).
- Clone và cài đặt đúng lockfile:

```sh
git clone https://github.com/CTU-OpenPaw/lattice-dx.git
cd lattice-dx
pnpm install --frozen-lockfile
```

### Quy ước kiến trúc & Tiêu chuẩn Pure-OSI

1. **Phân lớp thư mục:** Dịch vụ độc lập đặt tại `apps/`, thư viện dùng chung đặt tại `packages/`, các extension NocoBase đặt tại `plugins/nocobase/`.
2. **Kích thước tệp & giao tiếp:** Giữ tệp mã nguồn gọn, phân tách trách nhiệm rõ ràng (**khuyến nghị dưới 300 dòng/tệp** cho mã mới). Không import trực tiếp mã nội bộ giữa các app; chỉ giao tiếp qua public exports của `@dx/contracts` hoặc HTTP/REST API.
3. **Header bản quyền & SPDX:** Mọi tệp mã nguồn tự viết có hỗ trợ comment (`.ts`, `.tsx`, `.js`, `.jsx`, `.cjs`, `.mjs`, `.yml`, `.yaml`, `.ps1`, `.sh`, `.css`, `.sql`, `Dockerfile`) bắt buộc mang header chuẩn **CTU-OpenPaw** và `SPDX-License-Identifier: Apache-2.0` (kiểm tra tự động bằng `node scripts/source-headers.mjs --check`). Không sửa tệp tự sinh `apps/web/next-env.d.ts`.
4. **Ranh giới Pure-OSI:** Tuyệt đối không đưa `upstream/nocobase/`, `.gitmodules`, phụ thuộc mang giấy phép `BSL-1.1`, secret, tệp `.env`, khóa riêng (`*.pem`, `*.key`) hay dữ liệu thật vào kho mã nguồn. Mọi dependency mới phải tương thích OSI và cập nhật đồng bộ vào `docs/dependency-inventory.md`, `NOTICE` và `docs/sbom-cyclonedx.json`.

### Quy trình Issue, Conventional Commits & Pull Request

- **Theo dõi lỗi & đề xuất:** Tạo Issue trên `https://github.com/CTU-OpenPaw/lattice-dx` bằng biểu mẫu chuẩn tại `.github/ISSUE_TEMPLATE/bug_report.yml` hoặc `.github/ISSUE_TEMPLATE/feature_request.yml` (tuân thủ `CODE_OF_CONDUCT.md` — Contributor Covenant v2.1).
- **Quy ước commit:** Sử dụng **Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`).
- **Checklist bắt buộc trước khi mở Pull Request:**
  1. `pnpm check` (`typecheck`, `vitest`, `build`) — tất cả đạt.
  2. `node scripts/source-headers.mjs --check` và `pnpm pof:check` — đạt `6/6 PASS`.
  3. `pnpm release:sbom -- --check` — khớp `257/257` thành phần, `0 NONE`, `0 BSL-1.1`.
  4. Nếu sửa plugin NocoBase hoặc script PoF/demo: chạy `node --test plugins/nocobase/*/tests/*.test.cjs scripts/tests/*.test.mjs tests/nocobase-externals.test.mjs`.
  5. Nếu sửa `infra/compose/*.yml`: đảm bảo mọi image pin `@sha256:` và kiểm tra bằng `docker compose -f <file> config --quiet` cùng `pnpm test:infra`.
  6. Tự rà soát `git diff` để chắc chắn không còn `TODO` tồn đọng, log debug hay thông tin nhạy cảm.

---

## 3. Chính sách Bảo mật (`SECURITY.md`)

### Phiên bản được hỗ trợ

| Phiên bản / Nhánh | Trạng thái hỗ trợ |
| --- | --- |
| `0.4.x` (`main` trên `CTU-OpenPaw/lattice-dx`) | Được hỗ trợ cập nhật bản vá bảo mật |

### Cảnh báo Cấu hình Fixture Cục bộ

Các tệp Compose mặc định (`infra/compose/*.yml`) và tài liệu cài đặt cục bộ (`docs/native-clean-install.md`, `docs/core-local.md`) sử dụng mật khẩu **fixture công khai** chỉ dành cho kiểm thử loopback `127.0.0.1` / `localhost` (ví dụ: `local-demo-password`, `local-admin-password`, `local-nocobase-password`, `admin123`, `NativeLab-2026!`, `local-nocobase-app-key-public-fixture`). **Tuyệt đối không dùng các giá trị này trên môi trường mạng thật hoặc dữ liệu thực tế.**

### Các ranh giới bảo mật đã triển khai

- **Xác thực & Định danh:** Core API xác minh JWT chữ ký từ Keycloak (`OIDC_ISSUER` / `OIDC_JWKS_URL`); `@latticedx/plugin-enterprise-auth` dùng Authorization Code + PKCE S256 cho NocoBase.
- **Cô lập dữ liệu đa tenant:** `56` bảng tĩnh PG16 bật `FORCE ROW LEVEL SECURITY` (`nocobase_app`) + các bảng động `latticeCustom*` cùng khóa lạc quan `expectedVersion`.
- **Quét mã độc tệp tải lên:** Sidecar `@dx/file-scanner` kết nối **ClamAV `1.5.5`** qua TCP socket và lưu trữ trên **RustFS `1.0.6`**.
- **Toàn vẹn hạ tầng container:** 100% OCI images trong `infra/compose/*.yml` khóa digest `@sha256:` bất biến và được quét bởi CI (`Trivy` + `CodeQL`).

### Quy trình báo cáo lỗ hổng bảo mật

- **Không** công khai lỗ hổng, token, tệp `.env`, khóa riêng tư hoặc PII trong GitHub Issues hoặc Pull Requests.
- Báo cáo riêng tư qua **GitHub Security Advisories**:
  - **`https://github.com/CTU-OpenPaw/lattice-dx/security/advisories/new`**
- Đính kèm phạm vi ảnh hưởng, các bước tái hiện tối thiểu và phiên bản / commit SHA liên quan.

---

## 4. Tóm tắt Lịch sử Phát hành (`CHANGELOG.md`)

| Phiên bản | Ngày | Trọng tâm phát hành |
| --- | --- | --- |
| **`0.4.2`** | `2026-11-26` | Full P0/P1 Audit Remediation, UX Completion & Live `124/124` E2E Hardening |
| **`v0.4.1`** | `2026-11-26` | Deep System Audit, End-to-End Feature Completion & Multi-Portal UX Upgrade |
| **`v0.4.0`** | `2026-11-26` | DX-OS Open-Core Championship Edition (Waves 1–10) |
| **`v0.3.0`** | `2026-11-22` | Nền tảng Doanh nghiệp Toàn diện, AI HITL, RAG Ngữ nghĩa & IIoT Chuẩn OSI |
| **`v0.2.0`** | `2026-11-22` | Nâng cấp Kiến trúc Single-Engine & Gia cố Cấp Doanh nghiệp (Waves 1–5) |

### Chi tiết các cột mốc chính

#### `[0.4.2]` — `2026-11-26`
- **Toàn vẹn dữ liệu & Bảo mật (`56` bảng `FORCE RLS`):** Chặn `DROP TABLE` xuyên tenant trong `teardownBuiltApp(keepData=false)`, nâng `TENANT_RLS_TABLES` lên **`56` bảng tĩnh** (bổ sung `latticeAiQuotaPolicies` & `latticeUiSnapshots`), đóng 6 điểm thoát transaction RLS, khóa ACL `ldx_employee` khỏi Flow Studio/DMN, buộc `NODERED_ADMIN_PASS_HASH` fail-closed + mã hóa AES-256-CTR `flows_cred.json` và hoàn thiện PITR WAL `.gz`.
- **Mobile Field PWA (`/v/mobile`) & Public Portals:** Chuyển lỗi `400/403/404/409/422` trên IndexedDB Outbox sang trạng thái **`quarantined`** (tuyệt đối không làm mất ePOD), dừng ngay tại lỗi `401` đầu tiên, xử lý an toàn `/v/track/:code?verify=...` và nâng cấp `/v/form/:slug`.
- **AI Studio, Control Studio & LatticeFlow v2:** Đóng gói đủ **`163` ca Eval** vào runtime Eval Lab, hoàn thiện giao diện **Omnichannel Notify (`dxosNotify`)**, **`dxosForms:listSubmissions` Viewer**, DMN `UNIQUE`/`PRIORITY` + mô phỏng bản nháp, PKI `expectedKeyId` + `rotateKey`, và LatticeFlow v2 `loopCursor` bền vững + `control.merge` `first_completed`.
- **Kiểm chứng:** Đạt **`124/124`** live Docker Playwright/API E2E, Tier 5 `NO_GAPS`, **`2,509/2,509`** unit/integration tests (`1,128` Vitest + `1,381` Node) và **`163/163` (100%)** NL Eval.

#### `[0.4.1]` — `2026-11-26`
- **SBOM & Public Routes:** Chuẩn hóa `fsevents@2.3.3 = MIT` đạt **`257/257` thành phần có giấy phép** (`0 NONE`, `0` prod CVEs); bổ sung route `verifyTrackSignature`, `/v/lattice-brand.svg` xóa lỗi `401`/`403`/`404` trên cổng công khai.
- **UX & Multi-Provider LLM:** Sửa triệt để modal `DxosBiChartBlockModel`, hoàn thiện `WmsOpsBlock`, WebGIS Digital Twin drawer, Mobile Field PWA tiếng Việt và luồng P.A.R.A. OCR-to-Record; triển khai adapter LLM đa nhà cung cấp thật (`google-genai`, `anthropic`, `ollama`, `openai`, `deepseek`, `9router`) và gộp `latticeAgentProposals` vào Unified Approval Inbox.

#### `[0.4.0]` — `2026-11-26` (Waves 1–10)
- **Headless PaaS, PKI & Governance:** Khóa API phạm vi (`ldx_pat_*`), sổ cái bất biến Ed25519 + Merkle Root, OpenAPI 3.1.0 & AsyncAPI 3.0.0, Hot–Warm–Cold Tiering, Data Lineage, Quarantine & Arrhenius MKT.
- **Cold-Chain & 12 Native BlockModels:** OMS/WMS/FEFO (`FOR UPDATE`), ePOD + ISO QR SVG + `/v/track/:code` Ed25519, Visual Interactive DMN, MapLibre WebGIS, `DxosBiChartBlockModel` & Mobile PWA.
- **Agentic Core & LatticeFlow v2:** 24 node DAG / 6 nhóm, Draft/Publish versions, ReAct `ai.agent`, 20 Unified AI Tools + 7 Starter Profiles, App Builder 2.0 (`plan`/`patch`/`rollback`/`teardown` + ER Graph), Google/LF A2A, OTel GenAI (`latticeAiTraces`) & Trace Waterfall / Eval Lab, Stock `n8n` REST v1 + OAuth2 PKCE.
- **Pure-OSI Milestone:** Xóa bỏ hoàn toàn `upstream/nocobase` & `.gitmodules`; chuyển tầng cache sang **Valkey `8.1`** (`BSD-3-Clause`).

#### `[0.3.0]` — `2026-11-22`
- Hoàn thiện Record Chatter (`@mention` + diff), chứng từ bất biến (`Submit`/`Cancel`/`Amend`), xuất PDF Unicode, Chuông thông báo SSE, SLA Engine, Semantic Neural RAG (`pgvector` HNSW), AI HITL Queue, hạ tầng IIoT thuần OSI (`Mosquitto 2.0.21`, `Node-RED 4.0.9`, PG16 `latticeTelemetryPoints`), sidecar `apps/file-scanner` (ClamAV + RustFS) và nâng host runtime lên `nocobase/nocobase:2.2.50`.

#### `[0.2.0]` — `2026-11-22` (Waves 1–5)
- Thống nhất kiến trúc Single-Engine trên NocoBase + 7 plugin `Apache-2.0`, xây dựng `infra/compose/prod.yml` zero-trust, diễn tập DR cô lập (`--ephemeral`), hàng đợi Outbox `SKIP LOCKED`, SSO Keycloak OIDC + PKCE, Hybrid RAG & `46/46` NL Eval, GitOps Bundle và Command Palette `Ctrl+K`.

*(Ghi chú: Trước `v0.2.0`, nhánh khởi tạo `[0.1.0]` từ `2026-10-06` đến `2026-11-22` đặt nền móng monorepo, UC1/UC2 và bộ 7 plugin đầu tiên.)*

---

## Tài liệu liên quan

- [Chính sách Pure-OSI `Apache-2.0` & Ma trận PoF OLP PMNM 2026](/oss/pure-osi-policy)
- [Tuân thủ NocoBase `2.2.50` Điều khoản 5.2 & Ranh giới Mã nguồn](/oss/nocobase-clause-5-2)
- [CycloneDX 1.5 SBOM (`257/257`) & Quy trình Build-from-Source Offline](/oss/sbom-and-build-from-source)
