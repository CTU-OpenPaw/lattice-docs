---
layout: home

hero:
  name: LatticeDX v0.4.2
  text: Open-Core DX-OS Championship Edition
  tagline: Nền tảng Số Doanh nghiệp Mở Pure-OSI & Agentic App Builder
  image:
    src: /images/openpaw-logo.png
    alt: Logo CTU-OpenPaw LatticeDX
  actions:
    - theme: brand
      text: Khám phá LatticeDX
      link: /guide/what-is-latticedx
    - theme: alt
      text: Cài đặt Nhanh
      link: /getting-started/quick-start
    - theme: alt
      text: GitHub (CTU-OpenPaw)
      link: https://github.com/CTU-OpenPaw/lattice-dx

features:
  - icon: 🏛️
    title: Kiến trúc 6-Plane DX-OS
    details: Hợp nhất 4 không gian Con người [H] – Quy trình [P] – Dữ liệu [D] – Trí tuệ [I] trên 6 phân hệ điều phối độc lập, cô lập 5 lớp mạng Zero-Trust.
    link: /guide/architecture
  - icon: 🧩
    title: 7 Plugin Apache-2.0 (0.4.2)
    details: Mở rộng sạch trên host NocoBase 2.2.50 với sdkProvidedByHost = true, zero submodule upstream, bảo toàn tuyệt đối nhận diện Điều 5.2.
    link: /guide/plugins-modularity
  - icon: 🧱
    title: 12 Native v2 BlockModels & 7 Portals
    details: Trang bị DxosWebGisBlockModel (maplibre-gl), DxosBiChartBlockModel, DxosWmsOpsBlockModel, Mobile Field PWA (/v/mobile) và cổng công khai không PII.
    link: /guide/what-is-latticedx
  - icon: ⚡
    title: LatticeFlow v2 (24 Nodes) & Visual DMN
    details: Studio đồ thị @xyflow/react + @dagrejs/dagre, tách Draft/Publish, Loop Cursor HITL bền vững, Merge first_completed, ReAct ai.agent và Visual DMN.
    link: /guide/architecture
  - icon: 🤖
    title: DX-OS AI Studio (20 Tools) & MCP / A2A
    details: 7 Starter AI Profiles, App Builder 2.0 (plan/build/patch/rollback/verify), Google/LF A2A, 2-Way Streamable MCP và Eval Lab 163/163 ca tiếng Việt.
    link: /guide/plugins-modularity
  - icon: 🔐
    title: 56 Bảng FORCE RLS & Ed25519 PKI
    details: Cô lập đa tenant fail-closed với role không superuser nocobase_app, Scoped PAT (ldx_pat_*), sổ cái bất biến Ed25519 + Merkle Root và Keycloak OIDC/PKCE.
    link: /guide/architecture
  - icon: 📡
    title: IIoT Digital Twin & Stock n8n
    details: Eclipse Mosquitto 2.0.21 DynSec/LWT, FIWARE Orion-LD 1.12.0 2 chiều, Node-RED 4.0.9, Arrhenius MKT và tích hợp tùy chọn Stock n8n 2.48.1 REST v1 + PKCE.
    link: /guide/tech-stack-and-osi
  - icon: 🛡️
    title: Pure-OSI Apache-2.0 (257/257 SBOM)
    details: Loại bỏ hoàn toàn BSL-1.1 / ThingsBoard / EMQX; thay bằng Valkey 8.1 (BSD-3-Clause) và PostgreSQL 16 + pgvector 0.8.1 với CycloneDX 1.5 SBOM minh bạch.
    link: /guide/tech-stack-and-osi
---

<div class="vp-doc" style="max-width: 1152px; margin: 2.5rem auto 0; padding: 0 24px;">

## Kiến trúc Tổng thể 6-Plane DX-OS (`v0.4.2`)

LatticeDX `v0.4.2` tổ chức toàn bộ nền tảng số doanh nghiệp từ giao diện đa vai trò, tự động hóa quy trình, quản trị dữ liệu chuỗi thời gian IIoT đến lực lượng tác nhân AI có kiểm soát theo mô hình 6 phân hệ (**6-Plane DX-OS**), vận hành trên 5 vùng mạng Docker cô lập (`edge`, `app`, `data`, `scanner`, `iiot-net`).

![Kiến trúc 6-Plane DX-OS của LatticeDX v0.4.2](/images/architecture-vi.webp)

👉 Xem phân tích chi tiết 6 phân hệ, 5 mô thức tương tác và sơ đồ luồng dữ liệu tại [Kiến trúc 6-Plane DX-OS](/guide/architecture).

## Chỉ số Kiểm chứng Kỹ thuật & Nguồn mở (`v0.4.2`)

Mọi thông số dưới đây được kiểm chứng trực tiếp trên nhánh chính `CTU-OpenPaw/lattice-dx` phiên bản **`0.4.2`** (thuộc chuỗi phát hành `0.x`):

| Hạng mục kiểm chứng | Kết quả xác minh | Lệnh / Nguồn đối chiếu |
| --- | :---: | --- |
| **Kiểm thử Unit & Integration** | **`2,509 / 2,509` PASS** | `1,128` Vitest (152 tệp) + `1,381` `node --test` (174 tệp) |
| **Kiểm thử End-to-End (E2E)** | **`124 / 124` PASS** | Bộ kịch bản Playwright & API đa vai trò (`CHANGELOG.md` `v0.4.2`) |
| **Đánh giá AI Tiếng Việt (NL Eval)** | **`163 / 163` (`100%`)** | `node scripts/eval-vietnamese-nl-agent.mjs --min-pass=95` |
| **SBOM CycloneDX 1.5** | **`257 / 257` thành phần** | `pnpm release:sbom -- --check` (`workspace=12, npm=226, oci=19`, `0` `NONE`, `0` `BSL-1.1`) |
| **Cô lập Đa Tenant PostgreSQL** | **`56` bảng tĩnh `FORCE RLS`** | `54` bảng camelCase + `2` bảng snake-case (`pg-rls.js`), cộng bảng động `latticeCustom*` |
| **Header SPDX & Kiểm toán PoF** | **`1,098` tệp · `6/6` PASS** | `node scripts/source-headers.mjs --check` & `pnpm pof:check` (`0` lỗ hổng `pnpm audit`) |

## Hệ sinh thái Kho mã nguồn `CTU-OpenPaw`

| Kho mã nguồn | Giấy phép | Vai trò trong Hệ sinh thái | Liên kết |
| --- | :---: | --- | --- |
| **`CTU-OpenPaw/lattice-dx`** | `Apache-2.0` | Kho lõi LatticeDX `v0.4.2`: 7 plugin NocoBase `2.2.50`, Fastify API, Worker, ClamAV File Scanner và Docker Compose | [GitHub `lattice-dx`](https://github.com/CTU-OpenPaw/lattice-dx) |
| **`CTU-OpenPaw/lattice-docs`** | `Apache-2.0` / `MIT` | Cổng tài liệu kỹ thuật & quản trị nguồn mở song ngữ **Tiếng Việt / English** (`/en/`) | [Trang chủ Tiếng Việt](/guide/what-is-latticedx) · [English Docs](/en/) |
| **`CTU-OpenPaw/lattice-templates`** | `Apache-2.0` | Kho mẫu chuẩn hóa: LatticeFlow v2 blueprints, n8n workflows, bảng DMN, Business Packs, Public Forms & Solution Bundles | [GitHub `lattice-templates`](https://github.com/CTU-OpenPaw/lattice-templates) |
| **`CTU-OpenPaw`** | `Apache-2.0` | Hồ sơ tổ chức, quy chuẩn đóng góp chung, chính sách bảo mật và định hướng phát triển cộng đồng | [GitHub Organization](https://github.com/CTU-OpenPaw) |

</div>
