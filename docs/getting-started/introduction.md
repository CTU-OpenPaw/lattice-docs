---
title: Giới thiệu LatticeDX
description: Kiến trúc tổng thể 6 mặt phẳng, hệ 7 plugin Apache-2.0, phân quyền 8 vai trò và ranh giới runtime mở của LatticeDX 0.4.2.
---

# Giới thiệu LatticeDX

LatticeDX (`0.4.2`) là nền tảng vận hành doanh nghiệp số mã nguồn mở theo giấy phép `Apache-2.0`, kết hợp quản trị đa cổng nghiệp vụ, tự động hóa quy trình DAG và DMN, điều phối thiết bị công nghiệp IIoT và hệ thống tác tử AI gắn tri thức doanh nghiệp. Nền tảng đóng gói toàn bộ năng lực nghiệp vụ thành `7` plugin độc lập chạy trên runtime `nocobase/nocobase:2.2.50` với hợp đồng `sdkProvidedByHost: true`, tách bạch mã nguồn mở nội bộ khỏi hạ tầng container bên ngoài.

## Kiến trúc 6 mặt phẳng DX-OS

Hệ thống phân tách trách nhiệm theo `6` mặt phẳng nhằm kiểm soát cô lập dữ liệu, lưu lượng mạng và chu kỳ cập nhật độc lập theo từng phân hệ.

| Mặt phẳng | Thành phần chính | Trách nhiệm kỹ thuật | Tài liệu chi tiết |
| :--- | :--- | :--- | :--- |
| **Biên mạng và Định danh** | `Caddy 2.10`, `Apache APISIX 3.19.0`, `Keycloak 26.8.2` | Kết thúc TLS, tiêu chuẩn header bảo mật, giới hạn tần suất qua Valkey, xác thực OIDC PKCE `S256` và thu hồi phiên backchannel. | [Mô hình bảo mật](/architecture/security-model) |
| **Máy chủ và Đa cổng giao diện** | `nocobase/nocobase:2.2.50`, `8` vai trò `ldx_*`, `12` Native v2 BlockModel | Cung cấp không gian làm việc theo vai trò (`/p/<slug>`), biểu mẫu công khai `/v/form/:slug` và ứng dụng hiện trường ngoại tuyến `/v/mobile`. | [Đa cổng giao diện](/studio/multi-portal) |
| **Dữ liệu và Cô lập Tenant** | `PostgreSQL 16.16`, `pgvector 0.8.1`, `Valkey 8.1`, `RustFS 1.0.6`, `ClamAV 1.5.5` | Thực thi `FORCE ROW LEVEL SECURITY` trên `56` bảng tĩnh và các bảng `latticeCustom*` động bằng biến phiên `app.current_org`. | [Đa tenant và RLS](/architecture/multi-tenancy-rls) |
| **Tự động hóa và Quyết định** | `LatticeFlow v2` (`24` loại node), `Visual DMN 1.3`, `n8n 2.48.1` | Thực thi luồng DAG bền vững có vòng lặp lưu con trỏ, tạm dừng chờ phê duyệt con người, bảng quyết định FEEL và cầu nối `n8n` REST v1. | [Tổng quan LatticeFlow](/automation/latticeflow-overview) |
| **AI Studio và Kho tri thức** | `7` Agent Profile, `20` Unified Tool, `MCP` / `A2A`, `P.A.R.A. Hybrid RAG` | Chạy vòng lặp ReAct có kiểm tra hạn mức và ẩn PII, dựng ứng dụng tự động qua `plan -> build -> patch -> rollback` và tìm kiếm lai RRF. | [Tổng quan AI Studio](/ai/overview-and-profiles) |
| **IIoT Digital Twin và Sổ cái PKI** | `Mosquitto 2.0.21`, `Node-RED 4.0.9`, `Orion-LD 1.12.0`, `Ed25519 + Merkle` | Tiếp nhận telemetry MQTT DynSec, đồng bộ NGSI-LD qua outbox FIFO, tính toán MKT Arrhenius và ký bằng chứng ePOD không thể sửa đổi. | [Digital Twin IIoT](/domains/iiot-digital-twin) |

## Hệ 7 plugin mô-đun (`Apache-2.0`)

Toàn bộ phần mở rộng nghiệp vụ nằm dưới thư mục `plugins/nocobase/*`, cùng khóa phiên bản `0.4.2`, khai báo `"sdkProvidedByHost": true` và không nhúng mã nguồn lõi của NocoBase vào cây Git.

| Thư mục | Tên gói (`package.json`) | Entrypoint máy chủ | Nhiệm vụ cốt lõi |
| :--- | :--- | :--- | :--- |
| `action-bridge/` | `@latticedx/plugin-action-bridge` | `server.cjs` | Cầu nối hành động và ủy quyền OIDC giữa máy chủ NocoBase và gateway APISIX. |
| `plugin-lattice-foundation/` | `@latticedx/plugin-lattice-foundation` | `dist/server/index.js` | Giao dịch RLS (`app.current_org`, `app.rls_bypass`), khóa API `ldx_pat_*`, sổ cái Ed25519/Merkle, Outbox CloudEvents/NGSI-LD, đa cổng, biểu mẫu công khai, PWA, phê duyệt, thông báo, OTel và Prometheus. |
| `plugin-enterprise-auth/` | `@latticedx/plugin-enterprise-auth` | `dist/server/index.js` | Luồng đăng nhập Keycloak OIDC PKCE `S256` (`start`, `callback`, `finish`), ánh xạ nhóm vai trò và kiểm tra thu hồi phiên trong Valkey DB 2. |
| `plugin-dxos-para/` | `@latticedx/plugin-dxos-para` | `dist/server/index.js` | Mô hình hóa không gian tri thức P.A.R.A. (`Projects`, `Areas`, `Resources`, `Archives`) gắn ngữ cảnh tổ chức. |
| `plugin-dxos-blocks/` | `@latticedx/plugin-dxos-blocks` | `dist/server/index.js` | Đăng ký `12` Native v2 `Dxos*BlockModel` (Hero, KPI, Telemetry, AI Proposal, Tasks, P.A.R.A., Creative Studio, Workbench, WebGIS MapLibre, Kanban, WMS FEFO, BI Chart). |
| `plugin-dxos-studio/` | `@latticedx/plugin-dxos-studio` | `dist/server/index.js` | Động cơ `LatticeFlow v2`, trình đánh giá `Visual DMN`, trình tạo schema `latticeCustom*` với bộ công thức AST an toàn, `Solution Bundle v3`, kho lạnh OMS/WMS/FEFO/ePOD và cầu nối `n8n` / `OAuth2 PKCE`. |
| `plugin-dxos-ai/` | `@latticedx/plugin-dxos-ai` | `dist/server/index.js` | `7` Agent Profile, `20` Unified Tool có kiểm toán, `App Builder 2.0`, `MCP Gateway` (`/api/dxos-mcp`), `A2A Gateway` (`/api/dxos-a2a`), `P.A.R.A. Hybrid RAG`, OCR và `Eval Lab`. |

Đọc thêm quy trình build `esbuild`, các gói phụ thuộc ngoài dùng chung với host (`react@18.2.0`, `antd@5.24.2`, `@nocobase/server`) và vòng đời khởi tạo trong tài liệu [Hệ thống plugin](/architecture/plugin-system).

## Luồng xử lý yêu cầu và dịch vụ đồng hành

Mọi yêu cầu nghiệp vụ đi từ biên mạng tới cơ sở dữ liệu đều qua các lớp kiểm soát nhất quán:

| Tầng xử lý | Cơ chế kiểm soát |
| :--- | :--- |
| Xác thực và giới hạn tần suất tại biên | `Caddy 2.10` kết thúc TLS, gắn header bảo mật và chuyển tiếp tới `Apache APISIX 3.19.0`. APISIX gán `X-Request-Id`, áp đặt CORS và đếm ngưỡng truy cập theo IP trên Valkey (`limit-count`). |
| Giải quyết phiên và ngữ cảnh tenant | NocoBase xác thực JWT từ `Keycloak` hoặc khóa `ldx_pat_*` (băm SHA-256). Hàm `withTenantRlsContext` mở giao dịch PostgreSQL qua `AsyncLocalStorage` và chạy `SELECT set_config('app.current_org', :orgId, true)` dưới vai trò không phải siêu quản trị `nocobase_app`. |
| Thực thi nghiệp vụ và hàng đợi giao dịch | Mọi ghi nhận sự kiện (`latticeEventBus`, `latticeContextOutbox`) và bút toán băm chuỗi (`latticeCryptoLedger`) nằm chung giao dịch để tránh lệch trạng thái giữa bản ghi nghiệp vụ và hệ thống ngoài. |

Ngoài cụm plugin NocoBase, workspace còn cung cấp các dịch vụ đồng hành và giao thức liên tác mở:

| Thành phần | Giao thức / Cổng | Chức năng chính |
| :--- | :--- | :--- |
| `@dx/api` & `@dx/agent-worker` | HTTP REST `/v1/*` (`:4000` / `:4001`) | Dịch vụ Fastify lõi phục vụ bản ghi, kiểm toán tệp, hàng đợi tác tử và chẩn đoán hệ thống. |
| `@dx/file-scanner` | HTTP `:4010` + `ClamAV :3310` | Quét mã độc tệp tải lên trên mạng nội bộ `scanner` trước khi lưu vào `RustFS` hoặc `PostgreSQL`. |
| `MCP Gateway` | Streamable HTTP JSON-RPC 2.0 (`/api/dxos-mcp`) | Phơi bày `20` Unified Tool và `4` IT/OT tool (`/api/dxos-mcp/it-ot`) theo đúng RBAC của người gọi. |
| `A2A Gateway` | `/.well-known/agent-card.json` & `/api/dxos-a2a` | Công bố Agent Card và tiếp nhận tác vụ bất đồng bộ giữa các hệ thống tác tử bên ngoài. |

## Thông số nền tảng và ranh giới kỹ thuật

Bảng tham số dưới đây tổng hợp các hằng số kiến trúc cố định trong phiên bản `0.4.2`:

<ParamGrid
  title="Thông số kiến trúc cốt lõi LatticeDX 0.4.2"
  :items="[
    { name: 'platformVersion', type: 'semver', required: true, default: '0.4.2', description: 'Khóa phiên bản thống nhất trên package.json gốc và cả 7 plugin.' },
    { name: 'nocobase.testedRuntime', type: 'oci-tag', required: true, default: '2.2.50', description: 'Phiên bản container host nocobase/nocobase ghim bằng SHA-256.' },
    { name: 'nocobase.sdkProvidedByHost', type: 'boolean', required: true, default: 'true', description: 'Các plugin dùng @nocobase/* do host cung cấp lúc chạy, không đóng gói kèm mã lõi.' },
    { name: 'pg.rlsGucs', type: 'session-guc', required: true, default: 'app.current_org / app.rls_bypass', description: 'Hai biến PostgreSQL phạm vi giao dịch áp dụng FORCE RLS trên 56 bảng tĩnh và bảng động.' },
    { name: 'pg.runtimeRole', type: 'pg-role', required: true, default: 'nocobase_app', description: 'Vai trò sản xuất có thuộc tính NOSUPERUSER NOINHERIT NOBYPASSRLS.' },
    { name: 'valkey.databases', type: 'db-partition', default: 'DB 0 / DB 1 / DB 2', description: 'DB 0 cho Cache, DB 1 cho PubSub SSE, DB 2 cho trạng thái OIDC PKCE và thu hồi phiên.' },
    { name: 'pat.scopes', type: 'enum[7]', default: 'read, write, wms, dmn, iot, ai, ledger', description: 'Bảy phạm vi quyền áp dụng cho khóa API ldx_pat_* lưu dưới dạng hàm băm SHA-256.' },
    { name: 'solutionBundle.schema', type: 'string', default: 'latticedx.solution-bundle/v3', description: 'Định dạng gói cấu hình GitOps có kiểm tra SHA-256 và snapshot rollback.' }
  ]"
/>

## Mô hình 8 vai trò nghiệp vụ (`ldx_*`)

Ngoài tài khoản quản trị hệ thống `root` và `admin` của host, LatticeDX khởi tạo `8` vai trò nghiệp vụ chuyên biệt để phân tách không gian đa cổng (`/p/<slug>`) và giới hạn công cụ AI:

| Mã vai trò | Nhóm người dùng | Cổng và phạm vi thao tác tiêu biểu |
| :--- | :--- | :--- |
| `ldx_admin` | Quản trị viên tổ chức | Quản lý cổng nội bộ, khóa `ldx_pat_*`, kết nối ngoại vi, phân quyền trong phạm vi tenant. |
| `ldx_director` | Giám đốc vận hành | Phê duyệt hạn mức cao (`M-of-N`), xem báo cáo BI tổng hợp và điều phối liên phòng ban. |
| `ldx_manager` | Quản lý bộ phận | Phê duyệt quy trình (`control.approval`), quản lý quy tắc DMN, xử lý ngoại lệ chuỗi cung ứng. |
| `ldx_operator` | Kỹ sư vận hành IT/OT | Theo dõi WebGIS Digital Twin, xác nhận cảnh báo IIoT (`ack`/`escalate`) và gửi lệnh có HITL. |
| `ldx_warehouse` | Nhân sự kho vận | Xuất nhập tồn `FEFO`, kiểm soát lô hàng `latticeStockLots`, giữ/mở khóa chất lượng `MKT`. |
| `ldx_dispatcher` | Điều phối giao vận | Lập lịch đơn hàng, phân tuyến đội xe và theo dõi trạng thái chứng từ giao hàng. |
| `ldx_driver` | Tài xế hiện trường | Sử dụng PWA ngoại tuyến `/v/mobile`, chụp ảnh/chữ ký `ePOD` vào hàng đợi IndexedDB. |
| `ldx_employee` | Nhân viên nội bộ | Gửi yêu cầu mua sắm, phiếu dịch vụ, tra cứu kho tri thức `P.A.R.A.` và tác vụ cá nhân. |

Lưu ý bảo mật: bộ ánh xạ nhóm Keycloak (`DX_NATIVE_AUTH_GROUP_ROLE_MAP`) chặn tự động gán các vai trò đặc quyền như `ldx_admin`, `allowConfigure` hoặc vai trò bắt đầu bằng `pm` nếu không được cấu hình tường minh ở tầng quản trị.

## Các bài toán vận hành trọng tâm

LatticeDX giải quyết các quy trình đòi hỏi vừa linh hoạt ở tầng giao diện không mã nguồn vừa chặt chẽ ở tầng dữ liệu và kiểm toán:

| Miền bài toán | Năng lực kỹ thuật trọng tâm |
| :--- | :--- |
| Quản trị chuỗi lạnh OMS/WMS và chứng từ ePOD | Quản lý đơn hàng, lô tồn kho theo nguyên tắc `FEFO` (First Expired, First Out), tạm giữ chất lượng khi nhiệt độ động học trung bình (`MKT` theo phương trình Arrhenius) vượt ngưỡng, và cấp mã QR xác thực công khai kèm chữ ký `Ed25519` trên sổ cái `latticeCryptoLedger`. |
| Giám sát IIoT hai chiều theo chuẩn NGSI-LD | Thiết bị cảm biến gửi telemetry vào `Eclipse Mosquitto` (chế độ Dynamic Security, không cho phép kết nối ẩn danh) trên mạng nội bộ `iiot-net`. `Node-RED` chuẩn hóa dữ liệu đẩy vào NocoBase và `FIWARE Orion-LD`, đồng thời tiếp nhận lệnh điều chỉnh thông số xuống thiết bị kèm cơ chế xác nhận con người (`HITL`) khi độ lệch vượt ngưỡng `2.0°C`. |
| Tự động hóa đa lớp kết hợp quy tắc minh bạch | Kết hợp luồng `LatticeFlow v2` (`24` loại node hỗ trợ vòng lặp bền vững và tạm dừng chờ phê duyệt `M-of-N`), bảng quyết định `Visual DMN` (hỗ trợ `FIRST`, `UNIQUE`, `COLLECT`, `PRIORITY`) và các workflow `n8n` bên ngoài qua `OAuth2 PKCE` hoặc webhook ký chuẩn Standard Webhooks. |
| Tác tử AI có kiểm soát quyền và hạn mức | `7` Agent Profile hoạt động trong ranh giới RBAC và RLS của đúng người gọi, sử dụng `20` Unified Tool và `4` IT/OT MCP tool. Mọi đầu vào/đầu ra đi qua bộ ẩn dữ liệu nhạy cảm (CCCD, số điện thoại, tài khoản ngân hàng, mã số thuế, JWT), áp trần ngân sách token theo tổ chức/ngày và ghi trace chuẩn OpenTelemetry GenAI. |

## Ranh giới mã nguồn Pure-OSI và tuân thủ NocoBase

Mọi gói phần mềm trong workspace `lattice-dx` đều tuân thủ danh mục giấy phép Pure-OSI (`Apache-2.0`, `MIT`, `BSD`, `ISC`). Để giữ ranh giới bản quyền rõ ràng:

- Kho lưu trữ Git và gói phát hành nguồn không chứa thư mục `upstream/nocobase/` hay `.gitmodules`.
- Container `nocobase/nocobase:2.2.50` (ghim cố định bằng digest `@sha256:04b75164936e7314ef74d82844bc56c9f34ed7ff1ca976ca53ffac2d3c88d777`) chạy như một dịch vụ OCI bên ngoài và gắn `7` thư mục plugin ở chế độ chỉ đọc (`:ro`) vào `/app/nocobase/node_modules/@latticedx/*`.
- Phần ghi nhận tác quyền `Powered by NocoBase` (`v2.2.50`, `https://www.nocobase.com`) và trang `License settings` được giữ nguyên vẹn theo Điều 5.2 của NocoBase License Agreement.
- Tài nguyên bộ nhớ đệm và pub/sub sử dụng `Valkey 8.1` (`BSD-3-Clause`); tìm kiếm vector và lưu trữ chuỗi thời gian dùng `PostgreSQL 16` + `pgvector 0.8.1`.

## Các kho lưu trữ trong hệ sinh thái

Hệ sinh thái CTU-OpenPaw tổ chức tài nguyên thành `4` kho lưu trữ tách biệt theo vai trò:

| Kho lưu trữ | Vai trò | Thành phần tiêu biểu |
| :--- | :--- | :--- |
| `CTU-OpenPaw/lattice-dx` | Nền tảng lõi và hạ tầng triển khai | `7` plugin NocoBase, companion Fastify API/Worker/File-Scanner, cấu hình Docker Compose `infra/compose/*.yml`, script sao lưu PITR. |
| `CTU-OpenPaw/lattice-docs` | Cổng tài liệu kỹ thuật song ngữ | Tài liệu hướng dẫn, kiến trúc, đặc tả API và sơ đồ tương tác cho toàn bộ `9` phân hệ (tiếng Việt `/` và tiếng Anh `/en/`). |
| `CTU-OpenPaw/lattice-templates` | Kho mẫu nghiệp vụ GitOps | `43` artifact JSON gồm `latticeflow-blueprints`, `n8n-workflows`, `dmn-tables`, `business-packs`, `public-forms` và `Solution Bundle v3`. |
| `CTU-OpenPaw/.github` | Hồ sơ tổ chức và chính sách chung | Quy chuẩn đóng góp, báo cáo lỗ hổng bảo mật và tổng quan hệ sinh thái mã nguồn mở. |

## API kiểm tra trạng thái cơ bản

Sau khi khởi động máy chủ NocoBase, các endpoint công khai và tài liệu đặc tả máy đọc được sẵn sàng phục vụ ngay từ cổng gateway hoặc host cục bộ:

<ApiEndpoint
  method="GET"
  path="/api/app:getLang"
  auth="Public"
  summary="Kiểm tra trạng thái sẵn sàng của NocoBase host runtime và ngôn ngữ mặc định."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:openapi"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="read"
  summary="Xuất đặc tả OpenAPI 3.1.0 tự động tổng hợp cả các collection động latticeCustom*."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:asyncapi"
  auth="Bearer JWT | X-Lattice-API-Key"
  scope="read"
  summary="Xuất đặc tả AsyncAPI 3.0.0 cho Mosquitto MQTT, SSE surfaceEvents và Valkey PubSub."
/>

## Tài liệu liên quan

- [Cài đặt nhanh](/getting-started/quickstart) — Khởi chạy lab cô lập với `pnpm native:clean` hoặc cụm phát triển đầy đủ `pnpm local:up`.
- [Hồ sơ cài đặt và Compose](/getting-started/installation-profiles) — So sánh `8` file Compose, `5` profile sản xuất và định cỡ phần cứng.
- [Tổng quan kiến trúc](/architecture/overview) — Khám phá tương tác luồng dữ liệu qua `6` mặt phẳng DX-OS.
- [Cấp phép và thành phần thứ ba](/open-source/third-party-and-nocobase) — Chi tiết ranh giới Pure-OSI và tuân thủ NocoBase `2.2.50`.
