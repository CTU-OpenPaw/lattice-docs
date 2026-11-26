# LatticeDX v0.4.2 là gì?

**LatticeDX `v0.4.2` (DX-OS Open-Core Championship Edition)** là **Hệ điều hành Doanh nghiệp Số nguồn mở 6 Phân hệ** phát hành theo giấy phép **Apache-2.0** do nhóm **CTU-OpenPaw** phát triển hướng tới kỳ thi **OLP PMNM 2026 (VFOSSA)** và nhu cầu triển khai thực tế của doanh nghiệp Việt Nam.

Thay vì ghép nối rời rạc nhiều phần mềm đơn lẻ, LatticeDX hợp nhất **4 không gian vận hành cốt lõi H–P–D–I** trên một nền tảng dữ liệu đa tenant có kiểm soát:

- **`[H]` Human, Knowledge, Approvals & Public Forms:** Quản lý 7 vai trò chuẩn `ldx_*`, trao đổi trực tiếp trên bản ghi (`Record Chatter` hỗ trợ `@mention` và lịch sử thay đổi), chuông thông báo SSE thời gian thực, thông báo đa kênh (`email_smtp`, `telegram`, `slack`, `webhook`), động cơ phê duyệt đa cấp tuần tự/song song `M-of-N` kèm ủy quyền (`dxosApprovals` + `dxosDelegations`), kho tri thức **P.A.R.A.** trích xuất PDF/DOCX/XLSX/PPTX + OCR Form Autofill, biểu mẫu công khai không thu thập PII (`/v/form/:slug`) và tuyến di động hiện trường ngoại tuyến **Mobile Field PWA** (`/v/mobile`).
- **`[P]` Process, Poka-yoke, Visual DMN & LatticeFlow v2:** Chuẩn hóa 4 quy trình chống sai sót (*Poka-yoke*), công cụ ra quyết định **Visual DMN** (4 Hit Policies: `FIRST`, `UNIQUE`, `COLLECT`, `PRIORITY`), bộ dựng luồng tự động hóa đồ thị **LatticeFlow v2** (24 loại node thuộc 6 nhóm, tách riêng bản nháp `draftGraphJson` và bản phát hành `publishedGraphJson`), phân hệ chuỗi cung ứng lạnh **OMS/WMS/FEFO/ePOD** dùng khóa `FOR UPDATE` + in tem QR ISO/IEC 18004 + tra cứu công khai ký **Ed25519** (`/v/track/:code`), cùng cổng tích hợp tùy chọn **Stock `n8n` `2.48.1`** qua REST API v1.
- **`[D]` Data Governance, `FORCE RLS`, IIoT Digital Twin & WebGIS:** Bảo vệ dữ liệu đa tổ chức ở mức nhân PostgreSQL 16 qua **`56` bảng tĩnh `FORCE ROW LEVEL SECURITY`** (cộng các bảng động `latticeCustom*` trên role không superuser `nocobase_app`), **12 Native v2 `BlockModel`s** (bao gồm bản đồ WebGIS `maplibre-gl@6.19.0` và biểu đồ BI tổng hợp trực tiếp), phân tầng dữ liệu Hot–Warm–Cold, cách ly dữ liệu bất thường (Quarantine), tính chỉ số **Arrhenius MKT**, **2-Way Digital Twin Shadow** kết nối **Eclipse Mosquitto `2.0.21`**, **Node-RED `4.0.9`**, **FIWARE Orion-LD `1.12.0`**, **Connector Vault (`dxosVault` AES-256-GCM)** và **Event Bus CloudEvents 1.0 (`dxosEvents`)**.
- **`[I]` AI Workforce, App Builder 2.0, A2A & 2-Way MCP:** Điều phối **7 Starter AI Profiles** với **20 Unified AI Tools** (`11` công cụ quản trị bao gồm **App Builder 2.0** `plan`/`build`/`patch`/`rollback`/`verify`, `6` công cụ vận hành và `3` công cụ bộ nhớ bền vững `dxos_memory_*`), hỗ trợ giao thức **Google/LF A2A** (`/.well-known/agent-card.json`, `/api/dxos-a2a`), **2-Way Streamable MCP Gateway** (`/api/dxos-mcp`, `/api/dxos-mcp/it-ot`), theo dõi vết **OTel GenAI (`latticeAiTraces`)**, chủ động phân loại sự cố bằng LLM thật (`Proactive Triage`), hàng chờ phê duyệt **HITL**, che PII Việt Nam (CCCD, MST, STK, SĐT) và bộ kiểm chuẩn **163/163** câu lệnh tiếng Việt tự nhiên.

::: info Chính sách Khóa Phiên bản (`0.4.2`)
Toàn bộ hệ sinh thái LatticeDX hiện giữ nguyên nhánh phát triển **`0.4.2`** (thuộc dòng `0.x`). Mọi tài liệu, SBOM CycloneDX 1.5, manifest plugin và quy trình phát hành đều đồng nhất chuẩn phiên bản `0.4.2` cho đến khi có phê duyệt chính thức nâng mốc phát hành tiếp theo.
:::

---

## Bài toán Vận hành Doanh nghiệp Việt Nam

Khi triển khai chuyển đổi số tại doanh nghiệp vừa và nhỏ (SME), kho vận chuỗi lạnh, nhà máy sản xuất hoặc đội ngũ kỹ thuật bảo trì (CMMS) ở Việt Nam, các tổ chức thường gặp 5 điểm nghẽn lớn:

1. **Phân mảnh phần mềm ("rừng" công cụ rời rạc):** Phần mềm kế toán/ERP, quản lý kho WMS, hệ thống IoT giám sát nhiệt độ, công cụ phê duyệt nội bộ và trợ lý AI chạy tách biệt. Dữ liệu chứng từ không liên thông với dữ liệu cảm biến hay quy trình xử lý sự cố.
2. **Rủi ro khóa nhà cung cấp (Vendor Lock-in) & bẫy giấy phép:** Nhiều nền tảng IoT hoặc workflow thương mại áp dụng giấy phép nguồn hạn chế (**BSL-1.1** hoặc điều khoản thương mại giới hạn quy mô), khiến doanh nghiệp hoặc đơn vị tích hợp Việt Nam gặp rào cản pháp lý khi tùy biến và đóng gói lại giải pháp.
3. **Thiếu cô lập dữ liệu đa chi nhánh/đa đơn vị ở tầng CSDL:** Việc chỉ kiểm tra `organizationId` ở tầng giao diện hoặc API dễ dẫn đến rò rỉ dữ liệu chéo khi mở rộng Webhook, báo cáo BI, hoặc cấp quyền cho AI Agent truy vấn ngữ cảnh.
4. **Khoảng trống hiện trường và kết nối chập chờn:** Tài xế giao nhận chuỗi lạnh hay kỹ thuật viên bảo trì ngoài hiện trường cần giao diện di động nhẹ, chụp ảnh ePOD/quét QR ngay cả khi mất sóng (IndexedDB Outbox bền vững) và chia sẻ mã tra cứu đơn hàng cho đối tác mà **tuyệt đối không lộ thông tin cá nhân (PII)** của người nhận.
5. **AI rời rạc, khó kiểm soát và thiếu ngữ cảnh tiếng Việt:** Tích hợp LLM trực tiếp mà không có công cụ có schema chặt chẽ, không có phê duyệt con người (**HITL**), không che dữ liệu nhạy cảm (CCCD, mã số thuế, số tài khoản) và không có bộ Eval tiếng Việt sẽ không thể đưa vào vận hành doanh nghiệp thực tế.

---

## Tại sao chọn Open-Core DX-OS Pure-OSI?

LatticeDX `v0.4.2` giải quyết đồng thời bài toán kỹ thuật và tuân thủ nguồn mở thông qua triết lý **Open-Core DX-OS Pure-OSI**:

- **100% kho mã nguồn Git và tarball phát hành thuần chuẩn OSI (`Apache-2.0`):** Toàn bộ mã nguồn do nhóm tác giả phát triển (`apps/`, `packages/`, `plugins/nocobase/`, `scripts/`, `infra/`, `solutions/`, `tests/`) mang giấy phép **Apache-2.0**, gắn đầy đủ header `@copyright (C) 2026 CTU-OpenPaw` + `SPDX-License-Identifier: Apache-2.0` (`1,098` tệp được kiểm tra tự động qua `node scripts/source-headers.mjs --check`).
- **Tách ranh giới Host Runtime sạch sẽ:** Kho Git hoàn toàn không chứa submodule `upstream/nocobase` hay `.gitmodules`. Nền tảng host **NocoBase `2.2.50`** chỉ được nạp lúc chạy dưới dạng OCI container độc lập (`nocobase/nocobase:2.2.50`), trong khi 7 plugin của LatticeDX khai báo `"sdkProvidedByHost": true` và bảo toàn đầy đủ nhận diện **Điều 5.2 NocoBase** (`Powered by NocoBase`, `v2.2.50`, `https://www.nocobase.com`, `License settings`).
- **Loại bỏ triệt để thành phần BSL-1.1:** Không dùng ThingsBoard, EMQX, Redis bản mới hay TimescaleDB bản TSL; thay bằng bộ thành phần thuần OSI như **Valkey `8.1` (`BSD-3-Clause`)**, **Eclipse Mosquitto `2.0.21` (`EPL-2.0 OR BSD-3-Clause`)**, **Node-RED `4.0.9` (`Apache-2.0`)** và **PostgreSQL `16` + `pgvector 0.8.1`**. Công cụ `pnpm release:sbom -- --check` tự động kiểm tra `257/257` thành phần và chặn cứng mọi từ khóa `BSL-1.1`, `thingsboard`, `emqx`.
- **An toàn mặc định (Fail-Closed by Default):** 56 bảng tĩnh PostgreSQL `FORCE ROW LEVEL SECURITY` trên role không đặc quyền superuser `nocobase_app`, mạng Docker phân tách 5 vùng cô lập và quy trình kiểm toán 6 cổng (`pnpm pof:check`).

---

## So sánh LatticeDX v0.4.2 với các Nền tảng Truyền thống

| Tiêu chí | LatticeDX `v0.4.2` (Open-Core DX-OS) | SaaS ERP / Low-Code Đóng | Nền tảng IoT / Flow lai BSL-1.1 | Tự ghép Microservices (DIY) |
| --- | --- | --- | --- | --- |
| **Giấy phép & Chủ quyền mã nguồn** | **Apache-2.0 thuần OSI** (`257/257` SBOM, `0` BSL-1.1) | Độc quyền, đóng mã, phụ thuộc vendor | Hạn chế thương mại hóa/SaaS theo BSL-1.1 | Phụ thuộc năng lực kiểm soát SBOM nội bộ |
| **Cô lập Đa Tenant (Multi-Tenant)** | **56 bảng tĩnh `FORCE RLS`** + `nocobase_app` ở tầng PostgreSQL 16 | Chủ yếu ở tầng ứng dụng của nhà cung cấp | Thường tách instance hoặc lọc ở app-layer | Phải tự thiết kế và duy trì RLS trên từng dịch vụ |
| **Low-Code UI & Cổng Vai trò** | **7+ Portals**, **12 Native v2 BlockModels**, PWA `/v/mobile`, Public `/v/form` & `/v/track` | Đóng khung theo gói thuê bao | Thiếu trình dựng portal nghiệp vụ đa vai trò | Tốn nhiều tháng xây dựng UI CRUD, RBAC, PWA |
| **Tự động hóa & Quy trình** | **LatticeFlow v2 (24 nodes)** + **Visual DMN** + **Approvals M-of-N** + tùy chọn **Stock `n8n`** | Workflow nội bộ giới hạn tích hợp ngoài | Mạnh về tích hợp hoặc rule đơn giản, thiếu DMN/HITL chuẩn hóa | Phải tích hợp rời rạc BPMN, DMN, outbox, DLQ |
| **IIoT & Digital Twin** | **Mosquitto `2.0.21` DynSec/LWT** + **Orion-LD `1.12.0`** + **Node-RED `4.0.9`** + **MKT** | Không có sẵn hoặc phải mua add-on đắt đỏ | Khóa hệ sinh thái broker/DB của vendor | Tự dựng đường ống telemetry, quarantine và LWT |
| **AI Workforce & Governance** | **20 Tools**, **App Builder 2.0**, **MCP 2 chiều**, **A2A**, **OTel GenAI**, **163/163 NL Eval** | AI hộp đen, khó kiểm soát PII & trace | Chỉ dừng ở node gọi LLM đơn lẻ | Tự xây tool registry, HITL, PII redaction, eval |
| **Khả năng Tự triển khai & DR** | Docker Compose khóa `@sha256:`, **PITR WAL `.gz`**, **GitOps Solution Bundle v3** | Cloud-only hoặc chi phí on-prem rất cao | Đòi hỏi cấu hình phân tán phức tạp | Tự viết kịch bản sao lưu và diễn tập phục hồi |

---

## Bước tiếp theo

- Tìm hiểu chi tiết 6 phân hệ điều phối, 5 lớp mạng cô lập và luồng dữ liệu tại [Kiến trúc 6-Plane DX-OS](/guide/architecture).
- Khám phá ranh giới 7 plugin NocoBase `2.2.50` và cơ chế build `esbuild` tại [Kiến trúc Mô-đun 7 Plugin](/guide/plugins-modularity).
- Tra cứu danh mục 19 OCI images và cam kết Pure-OSI tại [Tech Stack & Ranh giới Pure-OSI](/guide/tech-stack-and-osi).
- Bắt tay vào cài đặt môi trường sạch trên máy cá nhân tại [Hướng dẫn Cài đặt Nhanh](/getting-started/quick-start).
