---
title: Tổng quan Kiến trúc Nền tảng (v0.4.2)
description: Kiến trúc 4 tầng, 5 mẫu tương tác nền tảng, 5 vùng mạng Docker cô lập, cấu trúc Compose và hệ sinh thái 4 kho mã nguồn Apache-2.0 của LatticeDX v0.4.2.
---

# Tổng quan Kiến trúc Nền tảng (v0.4.2)

LatticeDX `v0.4.2` tổ chức toàn bộ nền tảng số doanh nghiệp theo **kiến trúc 4 tầng** (**Tầng 3 Ứng dụng Nghiệp vụ** -> **Tầng 2 Trải nghiệm & Cấu hình** -> **Tầng 1 Runtime Headless & Dịch vụ Dùng chung** -> **Dữ liệu thuộc Dịch vụ**) kết hợp **5 mẫu tương tác chuẩn hóa** và **5 vùng mạng container cô lập**. Kiến trúc này tách biệt ứng dụng nghiệp vụ cắm-nóng, không gian đa cổng, runtime NocoBase `2.2.50` + `7` plugin Apache-2.0, tự động hóa IT/OT, lực lượng tác nhân AI và lõi lưu trữ PostgreSQL `16` áp dụng `FORCE ROW LEVEL SECURITY`.

<figure class="ldx-arch-figure">

![Kiến trúc Nền tảng LatticeDX v0.4.2 — 4 tầng, 5 mẫu tương tác và vận hành xuyên suốt](/images/architecture-v042-vi.webp)

<figcaption><strong>Sơ đồ Kiến trúc Nền tảng LatticeDX <code>v0.4.2</code>:</strong> tổng quan 4 tầng (Tầng 3 Ứng dụng Nghiệp vụ, Tầng 2 Trải nghiệm Người dùng &amp; Cấu hình, Tầng 1 Runtime Headless &amp; 5 lớp dịch vụ dùng chung, Dữ liệu thuộc Dịch vụ), 5 Mẫu Tương tác đầu cuối và các năng lực Vận hành Xuyên suốt.</figcaption>
</figure>

<PlatformPlanesDiagram />

## Kiến trúc 4 Tầng & Các Khối Dịch vụ

Mỗi tầng đảm nhận một ranh giới trách nhiệm rõ ràng; mọi thao tác ghi dữ liệu nghiệp vụ đều đi qua cổng kiểm soát hợp đồng và chính sách `FORCE RLS` ở Tầng 1, không truy cập tắt trực tiếp xuống bảng nội bộ.

| Tầng / Lớp | Phạm vi kiến trúc | Thành phần & Dịch vụ cốt lõi | Giao diện & Tuyến API chính |
| :--- | :--- | :--- | :--- |
| **Tầng 3 · Ứng dụng Nghiệp vụ Dạng Plug-in** | Giải pháp nghiệp vụ & ứng dụng AI | **Logistics Chuỗi lạnh & WMS** (`dxosWms`: đơn hàng, lô FEFO, Arrhenius MKT & ePOD), **Sự cố IIoT & Bản sao số** (telemetry, WebGIS & điều khiển 2 chiều), **CMMS & Khiếu nại Đối tác** (bảo trì, SLA), **Mua sắm, ITSM & Ứng dụng AI** (`latticeCustom*`) | `/p/logistics`, `/p/incidents`, `/p/cmms`, `/p/partner-claims`, `/p/procurement`, `/p/services`, `/v/track/:code` |
| **Tầng 2 · Trải nghiệm Người dùng & Cấu hình** | Các góc nhìn dùng chung một giao diện | **Không gian Theo vai trò** (`/p/*`, Mobile Field PWA `/v/mobile` dùng IndexedDB outbox + `quarantined`, Public `/v/form/:slug` không rò rỉ PII), **NocoBase & Studio Điều khiển**, **Góc nhìn Dữ liệu, BI & WebGIS** (`12` Native v2 `BlockModel`s gồm `maplibre-gl`, BI, WMS Ops), **AI Studio & Duyệt HITL** | `/p/<slug>`, `/v/mobile`, `/v/form/:slug`, `/admin/settings/dxos-studio`, `/admin/settings/dxos-ai` |
| **Tầng 1 · Truy cập & Định danh** | Quản lý truy cập & biên Zero-Trust | **Keycloak `26.8.2`** (OIDC + PKCE `S256`), **Cổng Caddy `2.10` & Apache APISIX `3.19.0`** (TLS `1.3`, HSTS, gỡ header `Server`, `X-Request-Id`, giới hạn tốc độ bằng Valkey), `@latticedx/plugin-enterprise-auth` | `/enterprise-login`, `/api/enterpriseAuth:*` |
| **Tầng 1 · Môi trường Chạy Ứng dụng** | Backend ứng dụng & logic nghiệp vụ | **Host `nocobase/nocobase:2.2.50`** nạp ngoài `7` plugin Apache-2.0 (`sdkProvidedByHost: true`, mount `:ro`), **Dịch vụ Nghiệp vụ Fastify `5`** (`/v1/*` & logic chuyên biệt) | `/api/dxos:health`, `/api/dxos:openapi`, `/api/dxos:asyncapi`, `/v1/*` |
| **Tầng 1 · Lõi Nền tảng Tự chủ** | Dịch vụ lõi do đội ngũ làm chủ | **App Registry & Bundle v3** (`dxosBuilder` cho `latticeCustom*`), **Adapters & Hợp đồng API** (OpenAPI `3.1.0`, AsyncAPI `3.0.0`, Vault AES-256-GCM `dxosVault`), **Chính sách Dùng chung** (`56` bảng tĩnh `FORCE RLS` với role `nocobase_app` + `ldx_pat_*`), **Outbox & Điều phối Sự kiện** (`dxosEvents`: CloudEvents `1.0`, Standard Webhooks `whsec_`, `FOR UPDATE SKIP LOCKED`, circuit breaker `5` lỗi/`120s`, DLQ) | `/api/dxosApiKeys:*`, `/api/dxosVault:*`, `/api/dxosEvents:*`, `/api/dxosBuilder:*`, `/api/dxosDataGov:*` |
| **Tầng 1 · Tự động hóa & Ngữ cảnh** | Luồng việc, tích hợp & ngữ cảnh IIoT | **LatticeFlow v2 & Phê duyệt** (`dxosAutomations`: `24` node / `6` nhóm, `loopCursor`, `dxosApprovals` `M-of-N` + `dxosDelegations`, `dxosNotify`), **Luật DMN Trực quan** (`dxosDmn` FEEL), **Stock `n8n` `2.48.1`** (tích hợp ngoài qua REST v1 & OAuth2 PKCE), **Broker NGSI-LD & MQTT** (FIWARE Orion-LD `1.12.0`, Eclipse Mosquitto `2.0.21` DynSec, Node-RED `4.0.9`, ngưỡng HITL `2.0°C`) | `/admin/settings/workflow/automation`, `/api/dxosAutomations:*`, `/api/dxosApprovals:*`, `/api/dxosDmn:*`, `/api/dxosN8n:*`, `/api/dxosBroker:*` |
| **Tầng 1 · Dịch vụ Agent AI** | Lực lượng tác nhân & dựng ứng dụng | **Business Agents & P.A.R.A. RAG** (`7` Profiles `dxos-coordinator`..`dxos-analyst`, `20` Unified Tools + `4` IT/OT MCP Tools, `/api/dxos-mcp`, `/api/dxos-a2a`, `/.well-known/agent-card.json`, che PII, hạn mức PostgreSQL, Hybrid RAG HNSW + RRF), **Application Builder 2.0** (Plan-Diff Schema/ER cô lập, Xem trước & Rollback an toàn) | `/api/dxos-mcp`, `/api/dxos-mcp/it-ot`, `/api/dxos-a2a`, `/api/dxosAi:*`, `/api/latticePara:*` |
| **Dữ liệu thuộc Dịch vụ** | Dịch vụ làm chủ lưu trữ & sổ cái | **PostgreSQL `16` + `pgvector` `0.8.1`** (`56` bảng `FORCE RLS` & vector HNSW), **Lưu trữ Đối tượng RustFS `1.0.6`**, **Orion-LD + MongoDB `8.0` & Valkey `8.1`**, **Sổ cái Ed25519 + Merkle** (`dxosLedger`) | `/api/dxosLedger:*`, `/api/dxosBlocks:*` |
| **Vận hành Xuyên suốt** | Kiểm toán, bảo mật, quét tệp & DR | **OTel Collector `0.123.0` + Prometheus `v3.3.0` + Grafana `11.5.8`** (W3C `traceparent` + OTel GenAI), **Vault & RBAC**, **Cách ly & Quét Tệp** (`file-scanner` + ClamAV `1.5.5`), **Gotenberg `8.20.1`** (`pdf`), **Sao lưu PITR WAL `.gz`**, **Bundle v3 & CycloneDX SBOM** | `/api/dxos:metrics` |

## 5 Mẫu Tương tác Nền tảng (Patterns 1–5)

Mọi nghiệp vụ thực tế đi qua một trong 5 mẫu tương tác chuẩn hóa sau, bảo đảm mọi thay đổi trạng thái đều qua ranh giới kiểm soát quyền và nhật ký giao dịch:

| Mẫu | Chuỗi thực thi đầu cuối |
| :---: | :--- |
| `1` | **Yêu cầu ứng dụng (Application request):** `Người dùng / Không gian vai trò` -> `Cổng Caddy 2.10 + APISIX 3.19.0` (chấm dứt TLS, `X-Request-Id`, `limit-count` Valkey) -> `NocoBase / API Nghiệp vụ` (xác thực `Keycloak` OIDC PKCE `S256` hoặc `ldx_pat_*`) -> `PostgreSQL 16 FORCE RLS` (`latticeNativeScope` gắn `app.current_org` dưới role `nocobase_app`). |
| `2` | **Tích hợp ngoài (External integration):** `Hệ thống ngoài` -> `Webhook Bảo vệ (HMAC Standard Webhooks whsec_)` -> `Event Bus (latticeEventBus, FOR UPDATE SKIP LOCKED, circuit breaker 5 lỗi/120s) / Adapter n8n 2.48.1` -> `API Dịch vụ Cấp quyền (ldx_pat_*)`. |
| `3` | **Tự động theo ngữ cảnh (Context-driven automation):** `Mosquitto 2.0.21 (DynSec/LWT) -> Node-RED 4.0.9` -> `NocoBase MKT & Outbox` -> `Broker NGSI-LD (FIWARE Orion-LD 1.12.0)` --*(Thông báo thay đổi / nét đứt)*--> `Luật DMN & MKT` -> `LatticeFlow v2 / Tác vụ` (kèm ngưỡng HITL `2.0°C` khi điều khiển 2 chiều xuống Node-RED). |
| `4` | **Agent nghiệp vụ (Business agent):** `Người dùng / Luồng / MCP / A2A` -> `Business Agent + P.A.R.A. Hybrid RAG (pgvector HNSW + RRF)` -> `20 Công cụ Cấp quyền (createAuditedTool: che PII tiếng Việt, hạn mức PostgreSQL, OTel GenAI)` -> `API Dịch vụ Cấp quyền (HITL cho thao tác ghi nhạy cảm)`. |
| `5` | **Dựng ứng dụng (Application builder):** `Builder · App Builder 2.0` -> `Plan & ER Diff Cô lập` (dry-run schema `latticeCustom*`) -> `Kiểm tra & Xem trước` -> `Người duyệt (Human Approval)` -> `Xuất bản Bundle v3 / Rollback An toàn` (không bao giờ ghi thẳng DB production). |

## 5 Vùng Mạng Cô lập trong Production (`prod.yml`)

Trong cấu hình triển khai sản xuất `infra/compose/prod.yml`, toàn bộ image được ghim cố định theo digest `@sha256` bất biến và phân tách vào **5 mạng Docker** riêng biệt. Bốn mạng bên trong đặt `internal: true` để ngăn mọi kết nối ra hoặc vào trực tiếp từ Internet.

<ParamGrid
  title="Phân vùng Mạng Docker (infra/compose/prod.yml)"
  :items="[
    { name: 'edge', type: 'bridge (public)', required: true, default: '80, 443', description: 'Mạng tiếp nhận lưu lượng TLS từ bên ngoài. Gồm caddy (TLS + HSTS), keycloak, gateway (APISIX 3.19.0) và nocobase.' },
    { name: 'app', type: 'bridge (internal: true)', required: true, default: 'internal', description: 'Mạng liên lạc HTTP/gRPC nội bộ giữa gateway, nocobase, file-scanner, orion-ld, nodered, n8n, gotenberg, otel-collector, prometheus và grafana.' },
    { name: 'data', type: 'bridge (internal: true)', required: true, default: 'internal', description: 'Mạng lưu trữ dữ liệu cô lập cho postgres (16.16), nocobase-db (pgvector 0.8.1-pg16), redis (Valkey 8.1), rustfs (1.0.6), orion-mongo (8.0) và lớp thu thập số liệu.' },
    { name: 'scanner', type: 'bridge (internal: true)', required: true, default: 'internal', description: 'Vùng cách ly quét mã độc tệp tải lên giữa file-scanner (4010) và clamd (ClamAV 1.5.5 tại cổng 3310) chạy với read_only: true.' },
    { name: 'iiot-net', type: 'bridge (internal: true)', required: true, default: 'internal', description: 'Mạng thiết bị biên IT/OT cô lập giữa Eclipse Mosquitto (1883), Node-RED (1880) và NocoBase Digital Twin broker.' }
  ]"
/>

### Phân hoạch Dữ liệu Cache & PubSub trên Valkey 8.1

Thay vì dùng một không gian khóa chung, LatticeDX tách **Valkey `8.1`** (`valkey/valkey:8.1-alpine`, BSD-3-Clause) thành các database logic tách biệt theo vai trò:

| Phân vùng Valkey | Biến / Thành phần | Dữ liệu lưu trữ & giới hạn |
| :--- | :--- | :--- |
| DB `0` | `CACHE_REDIS_URL` | Bộ nhớ đệm ứng dụng NocoBase (`CACHE_DEFAULT_STORE=redis`). |
| DB `1` | `PUBSUB_ADAPTER_REDIS_URL` | Kênh PubSub `latticedx:surface-updates` chuyển tiếp biến động bản ghi và quy trình tới luồng SSE `GET /api/dxosAi:surfaceEvents` (tối đa `1000` kết nối đồng thời, heartbeat `25s`). |
| DB `2` | `DX_NATIVE_AUTH_SESSION_REDIS_URL` | Lưu `state:` PKCE (`300s`), `ticket:` đăng nhập dùng một lần (`60s`), và khóa thu hồi phiên `revoked:` / `revoked_sid:` (`24h`). |
| Bộ đếm APISIX | `limit-count` (`policy: redis`) | Cụm bộ đếm giới hạn tốc độ theo IP với ngưỡng `120` / `240` / `300` yêu cầu mỗi `60s`. |

::: info Phân tách Hàng đợi Bền vững và PubSub
LatticeDX **không** sử dụng Redis/Valkey Streams cho tác vụ bền vững. Toàn bộ transactional outbox (`latticeContextOutbox` cho NGSI-LD và `latticeEventBus` cho webhook) nằm trong các bảng PostgreSQL `16` bảo vệ bởi `FORCE ROW LEVEL SECURITY` và khóa hàng `FOR UPDATE SKIP LOCKED`, giúp trạng thái đồng bộ luôn nằm trong cùng giao dịch ACID với dữ liệu nghiệp vụ.
:::

## Cấu trúc Compose & Profile Triển khai (`infra/compose/*`)

Môi trường phát triển cục bộ gán toàn bộ cổng dịch vụ vào `127.0.0.1` (`postgres`, `nocobase-db`, `redis`, `clamav`, `orion-mongo` và `mosquitto` không mở cổng ra máy chủ). Môi trường sản xuất `prod.yml` cung cấp 5 profile tùy chọn (`iam-sync`, `n8n`, `observability`, `pdf`, `iiot`) bên cạnh cụm dịch vụ mặc định.

| Tệp Compose | Project Name | Thành phần & Cổng Local (`127.0.0.1`) |
| :--- | :--- | :--- |
| `infra/compose/core.yml` | `lattice-dx` | Core API stack: `postgres`, `keycloak` (`:8081`), `api` (`:4000` nội bộ), `gateway` (`:8080`), `clamav` |
| `infra/compose/nocobase.yml` | `lattice-dx` | Host `nocobase` (`:13000`), `nocobase-db` (`pgvector`), `redis` (Valkey `8.1`) |
| `infra/compose/iiot.yml` | `lattice-dx` | Mạng `iiot-net`: `mosquitto` (`1883` nội bộ) và `nodered` (`:1880`) |
| `infra/compose/integration.yml` | `lattice-dx` | Tích hợp ngoài: `orion-mongo`, `orion-ld` (`:1026`), `n8n` (`:5678`) |
| `infra/compose/native-files.yml` | *(overlay)* | Gắn sidecar quét tệp `file-scanner` (`:4010`) và `clamav` scanning cho tệp đính kèm |
| `infra/compose/native-rehearsal.yml` | `lattice-native-rehearsal` | Cụm diễn tập nâng cấp cô lập (`nocobase-db` + `nocobase` trên `:13001`) |
| `infra/compose/uc1-sample.yml` | *(overlay)* | Dịch vụ mẫu `uc1-sample` (`:4100`) và `uc1-broker-worker` |
| `infra/compose/prod.yml` | `lattice-dx-prod` | Stack Zero-Trust sản xuất (`80`/`443` qua Caddy) và 5 profile bật thêm theo nhu cầu |

### 5 Profile Tùy chọn trong `prod.yml`

| Profile | Dịch vụ kích hoạt | Chức năng bổ sung |
| :--- | :--- | :--- |
| `iam-sync` | `keycloak-config-cli` (`6.5.1-26`) | Đồng bộ cấu hình realm `lattice-realm.prod.json` một lần lúc khởi tạo |
| `n8n` | `n8n` (`2.48.1`) | Động cơ workflow ngoài kết nối `n8n_app` trên PostgreSQL |
| `observability` | `otel-collector` (`0.123.0`), `prometheus` (`v3.3.0`), `grafana` (`11.5.8`) | Thu thập OTLP, cảnh báo 5 rule và dashboard `latticedx-360.json` |
| `pdf` | `gotenberg` (`8.20.1`) | Kết xuất chứng từ HTML sang PDF với `--chromium-disable-javascript=true` |
| `iiot` | `mosquitto` (`2.0.21`), `nodered` (`4.0.9`) | Broker MQTT DynSec và Node-RED chuyển đổi downlink trên `iiot-net` |

## Hệ sinh thái 4 Kho mã nguồn `CTU-OpenPaw`

Dự án duy trì cấu trúc 4 kho độc lập theo giấy phép Pure-OSI (`Apache-2.0`), tách biệt mã nguồn mở lõi, cổng tài liệu, thư viện mẫu GitOps và hồ sơ quản trị tổ chức.

| Kho mã nguồn | Giấy phép | Vai trò kỹ thuật | Liên kết |
| :--- | :--- | :--- | :--- |
| **`CTU-OpenPaw/lattice-dx`** | `Apache-2.0` | Mã nguồn lõi nền tảng `v0.4.2`: 7 plugin `@latticedx/*`, dịch vụ Fastify API `/v1/*`, AI worker, sidecar `file-scanner`, cấu hình Compose và tập lệnh sao lưu/khôi phục | [GitHub `lattice-dx`](https://github.com/CTU-OpenPaw/lattice-dx) |
| **`CTU-OpenPaw/lattice-docs`** | `Apache-2.0` / `MIT` | Cổng tài liệu kỹ thuật song ngữ Việt (`/`) và Anh (`/en/`) xây dựng bằng VitePress với hệ thống sơ đồ tương tác và tham chiếu API | [Trang chủ Docs](/) |
| **`CTU-OpenPaw/lattice-templates`** | `Apache-2.0` | Kho mẫu chuẩn hóa gồm 43 cấu phần JSON đã kiểm duyệt: LatticeFlow blueprints, n8n workflows, bảng DMN, Business Packs, Public Forms và Solution Bundle v3 | [GitHub `lattice-templates`](https://github.com/CTU-OpenPaw/lattice-templates) |
| **`CTU-OpenPaw/.github`** | `Apache-2.0` | Hồ sơ tổ chức GitHub, chuẩn đóng góp cộng đồng, chính sách bảo mật và thông tin điều phối hệ sinh thái | [GitHub `.github`](https://github.com/CTU-OpenPaw/.github) |

## Kiểm chứng Hạ tầng & Đặc tả Sống

Tầng Runtime Ứng dụng và Vận hành Xuyên suốt cung cấp các điểm cuối HTTP chuẩn hóa để kiểm tra tình trạng runtime, trích xuất đặc tả API tự động (bao gồm cả collection động `latticeCustom*`) và thu thập metric Prometheus.

<ApiEndpoint
  method="GET"
  path="/api/dxos:openapi"
  auth="Public | Bearer JWT | ldx_pat_*"
  summary="Trả về đặc tả OpenAPI 3.1.0 sinh tự động theo metadata hiện hành, bao gồm cả các collection động latticeCustom*."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:asyncapi"
  auth="Public | Bearer JWT | ldx_pat_*"
  summary="Trả về đặc tả AsyncAPI 3.0.0 mô tả 3 server (mqttBroker, httpGateway, redisPubSub) và 5 kênh bất đồng bộ."
/>

<ApiEndpoint
  method="GET"
  path="/api/dxos:metrics"
  auth="Bearer DX_METRICS_TOKEN | root | ldx_admin"
  summary="Xuất 16 nhóm metric Prometheus cho độ trễ HTTP, lỗi RLS, tồn đọng outbox/DLQ, AI tokens và kết nối SSE."
/>

<CodeTabs
  :tabs="[
    {
      label: 'Kiểm tra Health & Specs (bash)',
      lang: 'bash',
      code: '# Kiểm tra sức khỏe runtime NocoBase + 7 plugins\ncurl -fsS http://127.0.0.1:8080/api/dxos:health\n\n# Tải đặc tả sống OpenAPI 3.1.0 (gồm cả bảng latticeCustom*)\ncurl -fsS http://127.0.0.1:8080/api/dxos:openapi | jq \x22.openapi, .info.version\x22\n\n# Tải đặc tả AsyncAPI 3.0.0 (MQTT, SSE, Valkey PubSub, Webhooks)\ncurl -fsS http://127.0.0.1:8080/api/dxos:asyncapi | jq \x22.asyncapi, (.channels | keys)\x22'
    },
    {
      label: 'Metrics Prometheus (bash)',
      lang: 'bash',
      code: '# Truy xuất 16 nhóm metric Prometheus của LatticeDX\ncurl -fsS -H \x22Authorization: Bearer $DX_METRICS_TOKEN\x22 \\\n  http://127.0.0.1:8080/api/dxos:metrics'
    },
    {
      label: 'Cấu trúc AsyncAPI 3.0 Channels (json)',
      lang: 'json',
      code: '{\n  \x22asyncapi\x22: \x223.0.0\x22,\n  \x22servers\x22: {\n    \x22mqttBroker\x22: { \x22protocol\x22: \x22mqtt\x22 },\n    \x22httpGateway\x22: { \x22protocol\x22: \x22http\x22 },\n    \x22redisPubSub\x22: { \x22protocol\x22: \x22redis\x22 }\n  },\n  \x22channels\x22: {\n    \x22iotTelemetry\x22: {},\n    \x22iotDownlinkCommand\x22: {},\n    \x22surfaceEventsSse\x22: {},\n    \x22redisSurfaceUpdates\x22: {},\n    \x22contextOutboxWebhooks\x22: {}\n  }\n}'
    }
  ]"
/>

## Ranh giới Vận hành & Nguyên tắc Fail-Closed

| Nguyên tắc | Ranh giới kỹ thuật |
| :--- | :--- |
| Không gắn mã nguồn NocoBase vào kho Git | Kho `lattice-dx` không chứa `.gitmodules` hay thư mục `upstream/nocobase`. Host `nocobase/nocobase:2.2.50` chạy dưới dạng container OCI độc lập và nạp 7 plugin ở chế độ chỉ đọc (`:ro`). |
| Từ chối mặc định tại mọi lớp ranh giới | Nếu thiếu ngữ cảnh `app.current_org`, truy vấn PostgreSQL chỉ thấy `0` bản ghi; nếu tắt `DX_ALLOW_PUBLIC_SIGNUP`, biểu mẫu tự đăng ký bị khóa; mọi URL tích hợp ngoài bị chặn dải IP nội bộ/metadata (`169.254.*`) trừ khi khai báo rõ trong allowlist. |
| Bảo toàn nhận diện nguồn gốc | Chân trang `Powered by NocoBase`, phiên bản `v2.2.50` và `License settings` được giữ nguyên theo Điều 5.2 giấy phép NocoBase trên cả UI điều hành lẫn các cổng `/admin/*` và `/lattice/*`. |

## Tài liệu liên quan

- [Kiến trúc Hệ thống 7 Plugin & Hợp đồng Host](/architecture/plugin-system)
- [Kiến trúc Đa Tenant & PostgreSQL 16 FORCE RLS](/architecture/multi-tenancy-rls)
- [Mô hình Bảo mật Zero-Trust & Phân vùng Mạng](/architecture/security-model)
- [Triển khai Production Zero-Trust](/getting-started/production-deployment)
